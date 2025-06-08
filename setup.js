#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');

// 创建交互式命令行界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 配置模板
const ENV_TEMPLATE = `# 服务端口
PORT=3010

# 日志格式 (tiny, combined, common, dev, short)
MORGAN_FORMAT=tiny

# API Key与Cookie映射关系 (JSON格式)
# 格式: {"自定义API Key": "Cookie值"} 或 {"自定义API Key": ["Cookie值1", "Cookie值2"]}
API_KEYS={API_KEYS_PLACEHOLDER}

# 轮询策略 (random 或 round-robin 或 default)
ROTATION_STRATEGY=default

# 是否使用TLS代理 (true 或 false)
USE_TLS_PROXY={USE_TLS_PROXY_PLACEHOLDER}

# 是否使用辅助代理服务器 (true 或 false)
USE_OTHERS_PROXY={USE_OTHERS_PROXY_PLACEHOLDER}

# 代理服务器平台
# 可选值: auto, windows_x64, linux_x64, android_arm64
# auto: 自动检测平台
# windows_x64: Windows 64位
# linux_x64: Linux 64位
# android_arm64: 安卓ARM 64位
PROXY_PLATFORM={PROXY_PLATFORM_PLACEHOLDER}

# 是否使用其它接口 (true 或 false)
USE_OTHERS={USE_OTHERS_PLACEHOLDER}
`;

// 提示信息
console.log('===== Cursor-To-OpenAI 环境配置助手 =====');
console.log('这个脚本将帮助你配置必要的环境变量\n');

// 从现有.env文件加载配置
function loadExistingConfig() {
  const envPath = path.join(process.cwd(), '.env');
  let existingConfig = {
    apiKeys: {},
    useTlsProxy: true,
    useOthersProxy: true,
    proxyPlatform: 'auto',
    useOthers: true,
    rotationStrategy: 'default'
  };
  
  if (fs.existsSync(envPath)) {
    console.log('发现现有的.env配置文件，将加载现有设置作为默认值');
    console.log('提示: 直接按回车将保留现有设置不变\n');
    
    try {
      // 加载.env文件
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      
      // 提取API Keys
      if (envConfig.API_KEYS) {
        try {
          existingConfig.apiKeys = JSON.parse(envConfig.API_KEYS);
        } catch (e) {
          console.log('无法解析现有的API Keys配置，将使用默认设置');
        }
      }
      
      // 提取TLS代理配置
      if (envConfig.USE_TLS_PROXY !== undefined) {
        existingConfig.useTlsProxy = envConfig.USE_TLS_PROXY === 'true';
      }
      
      // 提取辅助代理服务器配置
      if (envConfig.USE_OTHERS_PROXY !== undefined) {
        existingConfig.useOthersProxy = envConfig.USE_OTHERS_PROXY === 'true';
      }
      
      // 提取代理服务器平台
      if (envConfig.PROXY_PLATFORM) {
        existingConfig.proxyPlatform = envConfig.PROXY_PLATFORM;
      }

      // 提取是否使用其它接口
      if (envConfig.USE_OTHERS !== undefined) {
        existingConfig.useOthers = envConfig.USE_OTHERS === 'true';
      }
      
      // 提取轮询策略
      if (envConfig.ROTATION_STRATEGY) {
        existingConfig.rotationStrategy = envConfig.ROTATION_STRATEGY;
      }
      
      console.log('成功加载现有配置');
    } catch (error) {
      console.error('加载现有配置时出错:', error.message);
      console.log('将使用默认设置');
    }
  } else {
    console.log('未找到现有的.env配置文件，将创建新的配置文件');
  }
  
  return existingConfig;
}

// 提示用户输入，带有默认值
function promptWithDefault(question, defaultValue) {
  return new Promise((resolve) => {
    const defaultText = defaultValue ? ` [${defaultValue}]` : '';
    rl.question(`${question}${defaultText}: `, (answer) => {
      // 如果用户只按了回车，使用默认值
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

// 收集配置信息
async function collectConfig() {
  // 加载现有配置
  const existingConfig = loadExistingConfig();
  
  const config = {
    apiKeys: {},
    useTlsProxy: existingConfig.useTlsProxy,
    useOthersProxy: existingConfig.useOthersProxy,
    proxyPlatform: existingConfig.proxyPlatform,
    useOthers: existingConfig.useOthers,
    rotationStrategy: existingConfig.rotationStrategy
  };

  // 询问是否使用TLS代理
  const useTlsProxyPrompt = `是否使用TLS代理服务器? (y/n)`;
  const defaultUseTlsProxy = existingConfig.useTlsProxy ? 'y' : 'n';
  const useTlsProxyAnswer = await promptWithDefault(useTlsProxyPrompt, defaultUseTlsProxy);
  config.useTlsProxy = useTlsProxyAnswer.toLowerCase() === 'y';

  if (config.useTlsProxy) {
    // 询问是否使用辅助代理服务器
    const useOthersProxyPrompt = `是否使用辅助代理服务器(port 10654)? (y/n)`;
    const defaultUseOthersProxy = existingConfig.useOthersProxy ? 'y' : 'n';
    const useOthersProxyAnswer = await promptWithDefault(useOthersProxyPrompt, defaultUseOthersProxy);
    config.useOthersProxy = useOthersProxyAnswer.toLowerCase() === 'y';
    
    // 询问代理服务器平台
    console.log('\n代理服务器平台选项:');
    console.log('- auto: 自动检测当前系统平台');
    console.log('- windows_x64: Windows 64位');
    console.log('- linux_x64: Linux 64位');
    console.log('- android_arm64: 安卓ARM 64位');
    
    const proxyPlatformPrompt = `选择代理服务器平台`;
    const defaultProxyPlatform = existingConfig.proxyPlatform || 'auto';
    config.proxyPlatform = await promptWithDefault(proxyPlatformPrompt, defaultProxyPlatform);
  }

  // 询问是否使用其它接口
  const useOthersPrompt = `是否使用其它接口? (y/n)`;
  const defaultUseOthers = existingConfig.useOthers ? 'y' : 'n';
  const useOthersAnswer = await promptWithDefault(useOthersPrompt, defaultUseOthers);
  config.useOthers = useOthersAnswer.toLowerCase() === 'y';

  // 询问轮询策略
  console.log('\n轮询策略选项:');
  console.log('- default: 默认策略');
  console.log('- random: 随机策略');
  console.log('- round-robin: 轮询策略');
  
  const rotationStrategyPrompt = `选择轮询策略`;
  const defaultRotationStrategy = existingConfig.rotationStrategy || 'default';
  config.rotationStrategy = await promptWithDefault(rotationStrategyPrompt, defaultRotationStrategy);

  // 处理API Keys
  const existingApiKeys = Object.keys(existingConfig.apiKeys);
  if (existingApiKeys.length > 0) {
    console.log('\n现有的API Keys:');
    existingApiKeys.forEach(key => console.log(`- ${key}`));
    
    const keepExistingApiKeys = await promptWithDefault('是否保留现有的API Keys? (y/n)', 'y');
    if (keepExistingApiKeys.toLowerCase() === 'y') {
      config.apiKeys = { ...existingConfig.apiKeys };
    }
  }

  // 询问是否添加新的API Key
  const addNewApiKey = await promptWithDefault('是否添加新的API Key? (y/n)', existingApiKeys.length === 0 ? 'y' : 'n');
  if (addNewApiKey.toLowerCase() === 'y') {
    const apiKey = await promptWithDefault('请输入自定义的API Key (不含sk-前缀，将自动添加)', '');
    if (apiKey) {
      const fullApiKey = apiKey.startsWith('sk-') ? apiKey : `sk-${apiKey}`;
      config.apiKeys[fullApiKey] = [];
    } else {
      // 如果用户直接回车跳过，默认添加 sk-text
      config.apiKeys['sk-text'] = [];
      console.log('已默认添加API Key: sk-text');
    }
  } else if (Object.keys(config.apiKeys).length === 0) {
    // 如果没有任何API Key，默认添加 sk-text
    config.apiKeys['sk-text'] = [];
    console.log('已默认添加API Key: sk-text');
  }

  return config;
}

// 生成配置文件
function generateEnvFile(config) {
  try {
    // 准备API Keys
    const apiKeysJson = JSON.stringify(config.apiKeys);
    
    // 替换模板中的占位符
    let envContent = ENV_TEMPLATE
      .replace('{API_KEYS_PLACEHOLDER}', apiKeysJson)
      .replace('{USE_TLS_PROXY_PLACEHOLDER}', config.useTlsProxy)
      .replace('{USE_OTHERS_PROXY_PLACEHOLDER}', config.useOthersProxy)
      .replace('{PROXY_PLATFORM_PLACEHOLDER}', config.proxyPlatform)
      .replace('{USE_OTHERS_PLACEHOLDER}', config.useOthers);
    
    // 更新轮询策略
    envContent = envContent.replace('ROTATION_STRATEGY=default', `ROTATION_STRATEGY=${config.rotationStrategy}`);
    
    // 写入.env文件
    const envPath = path.join(process.cwd(), '.env');
    
    // 检查是否存在备份文件
    const backupPath = path.join(process.cwd(), '.env.backup');
    if (fs.existsSync(envPath)) {
      // 创建备份
      fs.copyFileSync(envPath, backupPath);
      console.log(`\n✅ 已创建原配置文件备份: ${backupPath}`);
    }
    
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`\n✅ 配置文件已生成: ${envPath}`);
    
    // 检查data目录
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`✅ 创建数据目录: ${dataDir}`);
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ 生成配置文件时出错:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  try {
    const config = await collectConfig();
    
    if (generateEnvFile(config)) {
      console.log('\n===== 配置完成 =====');
      console.log('你可以使用以下命令启动服务:');
      console.log('  npm start');
      
      // 显示TLS代理配置信息
      console.log(`\n当前TLS代理配置:`);
      console.log(`- 是否启用TLS代理: ${config.useTlsProxy ? '是' : '否'}`);
      if (config.useTlsProxy) {
        console.log(`- 是否启用辅助代理服务器: ${config.useOthersProxy ? '是' : '否'}`);
        console.log(`- 代理服务器平台: ${config.proxyPlatform}`);
      }

      // 显示是否使用其它接口配置信息
      console.log(`\n当前是否使用其它接口: ${config.useOthers ? '是' : '否'}`);
      
      // 显示轮询策略
      console.log(`\n当前轮询策略: ${config.rotationStrategy}`);
      
      // 显示API Keys
      console.log('\n当前配置的API Keys:');
      Object.keys(config.apiKeys).forEach(key => console.log(`- ${key}`));
    }
  } catch (error) {
    console.error('\n❌ 配置过程中出错:', error.message);
  } finally {
    rl.close();
  }
}

// 运行主函数
main(); 