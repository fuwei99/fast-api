const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('./logger');

let mainProxyProcess = null;
let othersProxyProcess = null;
let mainProxyLogStream = null;
let othersProxyLogStream = null;

/**
 * 获取当前系统平台
 * @returns {string} 平台标识
 */
function detectPlatform() {
  const platform = os.platform();
  const arch = os.arch();
  
  if (platform === 'win32' && arch === 'x64') {
    return 'windows_x64';
  } else if (platform === 'linux' && arch === 'x64') {
    return 'linux_x64';
  } else if ((platform === 'android' || platform === 'linux') && (arch === 'arm64' || arch === 'aarch64')) {
    return 'android_arm64';
  }
  
  // 默认返回linux版本
  logger.warn(`未识别的平台: ${platform} ${arch}，将使用linux_x64代理`);
  return 'linux_x64';
}

/**
 * 获取代理服务器可执行文件路径
 * @param {string} platform 平台类型
 * @param {string} proxyType 代理类型 ('main' 或 'others')
 * @returns {string} 可执行文件路径
 */
function getProxyExecutablePath(platform, proxyType = 'main') {
  let proxyDir;
  
  if (proxyType === 'others') {
    proxyDir = path.join(process.cwd(), 'src', 'proxy', 'others');
  } else {
    proxyDir = path.join(process.cwd(), 'src', 'proxy');
  }
  
  // 根据平台选择可执行文件
  switch (platform) {
    case 'windows_x64':
      return path.join(proxyDir, 'cursor_proxy_server_windows_amd64.exe');
    case 'linux_x64':
      return path.join(proxyDir, 'cursor_proxy_server_linux_amd64');
    case 'android_arm64':
      return path.join(proxyDir, 'cursor_proxy_server_android_arm64');
    default:
      logger.warn(`未知平台: ${platform}，将使用linux_x64代理`);
      return path.join(proxyDir, 'cursor_proxy_server_linux_amd64');
  }
}

/**
 * 创建并打开代理服务器日志文件
 * @param {string} platform 平台类型
 * @param {string} proxyType 代理类型 ('main' 或 'others')
 * @returns {fs.WriteStream} 日志文件写入流
 */
function createProxyLogFile(platform, proxyType = 'main') {
  try {
    // 确保logs目录存在
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // 创建日志文件名，包含日期和平台信息
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const logFileName = `proxy_server_${proxyType}_${platform}_${dateStr}.log`;
    const logFilePath = path.join(logsDir, logFileName);
    
    // 创建日志文件流
    const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    
    // 写入日志文件头
    const headerLine = `\n\n========== ${proxyType}代理服务器日志 - ${platform} - ${now.toISOString()} ==========\n\n`;
    logStream.write(headerLine);
    
    logger.info(`${proxyType}代理服务器详细日志将记录到: ${logFilePath}`);
    
    return logStream;
  } catch (error) {
    logger.error(`创建${proxyType}代理服务器日志文件失败: ${error.message}`);
    return null;
  }
}

/**
 * 写入日志到代理服务器日志文件
 * @param {fs.WriteStream} logStream 日志文件流
 * @param {string} message 日志消息
 * @param {string} type 日志类型 (stdout 或 stderr)
 */
function writeToProxyLog(logStream, message, type = 'stdout') {
  if (!logStream) return;
  
  try {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${type}] ${message}\n`;
    logStream.write(logLine);
  } catch (error) {
    logger.error(`写入代理服务器日志失败: ${error.message}`);
  }
}

/**
 * 启动单个代理服务器
 * @param {string} platform 平台类型
 * @param {string} proxyType 代理类型 ('main' 或 'others')
 * @param {number} port 代理服务器端口
 * @returns {object} 包含进程和日志流的对象
 */
function startSingleProxyServer(platform, proxyType, port) {
  try {
    // 获取可执行文件路径
    const execPath = getProxyExecutablePath(platform, proxyType);
    
    // 检查文件是否存在
    if (!fs.existsSync(execPath)) {
      logger.error(`${proxyType}代理服务器可执行文件不存在: ${execPath}`);
      return { process: null, logStream: null };
    }
    
    // 在Linux/Android上，设置可执行权限
    if (platform !== 'windows_x64') {
      try {
        fs.chmodSync(execPath, '755');
      } catch (err) {
        logger.warn(`无法设置${proxyType}代理服务器可执行权限: ${err.message}`);
      }
    }
    
    // 创建代理服务器日志文件
    const logStream = createProxyLogFile(platform, proxyType);
    
    // 启动代理服务器进程
    logger.info(`正在启动${platform}平台的${proxyType}代理服务器: ${execPath}，端口: ${port}`);
    
    // 添加端口参数
    const args = port ? [`--port=${port}`] : [];
    
    const proxyProcess = spawn(execPath, args, {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // 记录代理服务器的详细日志到文件
    proxyProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      writeToProxyLog(logStream, output, 'stdout');
    });
    
    proxyProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString().trim();
      writeToProxyLog(logStream, errorOutput, 'stderr');
      
      // 只在启动失败时记录错误信息到控制台
      if (!proxyProcess.startSuccessful && errorOutput.includes('error')) {
        logger.error(`${proxyType}代理服务器启动错误: ${errorOutput.split('\n')[0]}`);
      }
    });
    
    proxyProcess.on('error', (err) => {
      logger.error(`${proxyType}代理服务器启动失败: ${err.message}`);
      writeToProxyLog(logStream, `启动失败: ${err.message}`, 'error');
      return { process: null, logStream: null };
    });
    
    proxyProcess.on('close', (code) => {
      // 只有在非正常退出时记录到控制台
      if (code !== 0) {
        logger.warn(`${proxyType}代理服务器已退出，代码: ${code}`);
      }
      
      writeToProxyLog(logStream, `进程已退出，退出代码: ${code}`, 'info');
      
      // 关闭日志文件
      if (logStream) {
        logStream.end();
      }
    });
    
    // 等待一段时间确保启动成功
    setTimeout(() => {
      if (proxyProcess && proxyProcess.exitCode === null) {
        proxyProcess.startSuccessful = true;
        logger.info(`${proxyType}代理服务器已成功启动`);
        writeToProxyLog(logStream, `${proxyType}代理服务器已成功启动`, 'info');
      } else {
        logger.error(`${proxyType}代理服务器启动失败或异常退出`);
        writeToProxyLog(logStream, `${proxyType}代理服务器启动失败或异常退出`, 'error');
      }
    }, 1000);
    
    return { process: proxyProcess, logStream };
  } catch (error) {
    logger.error(`启动${proxyType}代理服务器出错: ${error.message}`);
    return { process: null, logStream: null };
  }
}

/**
 * 启动代理服务器
 * @returns {boolean} 是否成功启动
 */
function startProxyServer() {
  try {
    // 检查是否启用代理
    const useTlsProxy = process.env.USE_TLS_PROXY === 'true';
    if (!useTlsProxy) {
      logger.warn('TLS代理服务器未启用，跳过启动');
      return true;
    }
    
    // 检查是否启用辅助代理服务器
    const useOthersProxy = process.env.USE_OTHERS_PROXY === 'true';
    
    // 确定要使用的平台
    let platform = process.env.PROXY_PLATFORM || 'auto';
    if (platform === 'auto') {
      platform = detectPlatform();
    }
    
    // 启动主代理服务器（默认使用8080端口）
    const mainProxy = startSingleProxyServer(platform, 'main', 8080);
    mainProxyProcess = mainProxy.process;
    mainProxyLogStream = mainProxy.logStream;
    
    // 根据配置决定是否启动辅助代理服务器
    if (useOthersProxy) {
      logger.info('辅助代理服务器已启用，正在启动...');
      // 启动others代理服务器（端口 10654）
      const othersProxy = startSingleProxyServer(platform, 'others', 10654);
      othersProxyProcess = othersProxy.process;
      othersProxyLogStream = othersProxy.logStream;
      
      // 如果辅助代理启动失败，记录警告
      if (!othersProxyProcess) {
        logger.warn('辅助代理服务器启动失败');
      } else {
        logger.info('辅助代理服务器启动成功');
      }
    } else {
      logger.warn('辅助代理服务器未启用，跳过启动');
    }
    
    // 如果主代理启动失败，记录警告
    if (!mainProxyProcess) {
      logger.warn('主代理服务器启动失败');
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`启动代理服务器出错: ${error.message}`);
    return false;
  }
}

/**
 * 停止代理服务器
 */
function stopProxyServer() {
  const stopSingleProxy = (proxyProcess, logStream, proxyType) => {
    if (proxyProcess) {
      logger.info(`正在停止${proxyType}代理服务器...`);
      writeToProxyLog(logStream, `正在停止${proxyType}代理服务器`, 'info');
      
      // 在Windows上，使用taskkill强制终止
      if (os.platform() === 'win32') {
        try {
          spawn('taskkill', ['/pid', proxyProcess.pid, '/f', '/t']);
        } catch (err) {
          logger.error(`使用taskkill终止${proxyType}代理进程失败: ${err.message}`);
          writeToProxyLog(logStream, `使用taskkill终止${proxyType}代理进程失败: ${err.message}`, 'error');
        }
      } else {
        // 在Linux/Mac上直接kill
        proxyProcess.kill('SIGTERM');
      }
      
      // 允许一些时间写入最后的日志
      setTimeout(() => {
        // 关闭日志文件
        if (logStream) {
          logStream.end();
        }
      }, 500);
    }
  };
  
  // 停止主代理服务器
  stopSingleProxy(mainProxyProcess, mainProxyLogStream, 'main');
  mainProxyProcess = null;
  mainProxyLogStream = null;
  
  // 停止others代理服务器
  stopSingleProxy(othersProxyProcess, othersProxyLogStream, 'others');
  othersProxyProcess = null;
  othersProxyLogStream = null;
}

// 导出模块
module.exports = {
  startProxyServer,
  stopProxyServer
}; 