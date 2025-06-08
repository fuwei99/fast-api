const express = require('express');
const router = express.Router();
const { fetch, ProxyAgent, Agent } = require('undici');

const $root = require('../proto/message.js');
const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const { generateCursorBody, chunkToUtf8String, generateHashed64Hex, generateCursorChecksum } = require('../utils/utils.js');
const keyManager = require('../utils/keyManager.js');
const { spawn } = require('child_process');
const path = require('path');
const admin = require('../models/admin');
const config = require('../config/config');
const crypto = require('crypto');
const logger = require('../utils/logger');

const activeRequestControllers = new Map(); // 用于存储 API Key -> AbortController 的映射

// 存储刷新状态的变量
let refreshStatus = {
  isRunning: false,
  status: 'idle', // idle, running, completed, failed
  message: '',
  startTime: null,
  endTime: null,
  error: null
};

// 储存当前正在处理的Cookie获取请求
const pendingCookieRequests = new Map();

// 检查是否已有管理员账号
router.get('/admin/check', (req, res) => {
  try {
    return res.json({
      success: true,
      exists: admin.hasAdmin()
    });
  } catch (error) {
    logger.error('检查管理员账号失败:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 注册管理员
router.post('/admin/register', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }
    
    const token = admin.register(username, password);
    
    return res.json({
      success: true,
      message: '注册成功',
      token
    });
  } catch (error) {
    logger.error('注册管理员失败:', error);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// 管理员登录
router.post('/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }
    
    const token = admin.login(username, password);
    
    return res.json({
      success: true,
      message: '登录成功',
      token
    });
  } catch (error) {
    logger.error('登录失败:', error);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// 验证token
router.get('/admin/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供认证token'
      });
    }
    
    const token = authHeader.split(' ')[1];
    const result = admin.verifyToken(token);
    
    return res.json(result);
  } catch (error) {
    logger.error('验证token失败:', error);
    return res.status(401).json({
      success: false,
      message: error.message
    });
  }
});

// 添加API key管理路由
router.post("/api-keys", async (req, res) => {
  try {
    const { apiKey, cookieValues } = req.body;
    
    if (!apiKey || !cookieValues) {
      return res.status(400).json({
        error: 'API key and cookie values are required',
      });
    }
    
    keyManager.addOrUpdateApiKey(apiKey, cookieValues);
    
    return res.json({
      success: true,
      message: 'API key added or updated successfully',
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// 获取所有API Keys
router.get("/api-keys", async (req, res) => {
  try {
    logger.info('收到获取API Keys请求');
    const apiKeys = keyManager.getAllApiKeys();
    logger.info('获取到的API Keys:', apiKeys);
    
    const result = {
      success: true,
      apiKeys: apiKeys.map(apiKey => ({
        key: apiKey,
        cookieCount: keyManager.getAllCookiesForApiKey(apiKey).length,
      })),
    };
    logger.info('返回结果:', result);
    
    return res.json(result);
  } catch (error) {
    logger.error('获取API Keys失败:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 删除API key
router.delete("/api-keys/:apiKey", async (req, res) => {
  try {
    const { apiKey } = req.params;
    
    keyManager.removeApiKey(apiKey);
    
    return res.json({
      success: true,
      message: 'API key removed successfully',
    });
  } catch (error) {
    logger.error(error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// 获取特定API Key的Cookie值
router.get("/api-keys/:apiKey/cookies", async (req, res) => {
  try {
    const { apiKey } = req.params;
    logger.info(`收到获取API Key ${apiKey}的Cookie值请求`);
    
    const cookies = keyManager.getAllCookiesForApiKey(apiKey);
    logger.info(`API Key ${apiKey}的Cookie值:`, cookies);
    
    return res.json({
      success: true,
      cookies: cookies
    });
  } catch (error) {
    logger.error(`获取API Key ${req.params.apiKey}的Cookie值失败:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 获取所有无效的cookie
router.get("/invalid-cookies", async (req, res) => {
  try {
    const invalidCookies = keyManager.getInvalidCookies();
    
    return res.json({
      success: true,
      invalidCookies: Array.from(invalidCookies)
    });
  } catch (error) {
    logger.error('获取无效cookie失败:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 清除特定的无效cookie
router.delete("/invalid-cookies/:cookie", async (req, res) => {
  try {
    const { cookie } = req.params;
    const success = keyManager.clearInvalidCookie(cookie);
    
    return res.json({
      success: success,
      message: success ? '无效cookie已清除' : '未找到指定的无效cookie'
    });
  } catch (error) {
    logger.error('清除无效cookie失败:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 清除所有无效cookie
router.delete("/invalid-cookies", async (req, res) => {
  try {
    keyManager.clearAllInvalidCookies();
    
    return res.json({
      success: true,
      message: '所有无效cookie已清除'
    });
  } catch (error) {
    logger.error('清除所有无效cookie失败:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 批量添加无效cookie
router.post("/invalid-cookies", async (req, res) => {
  try {
    const { invalidCookies } = req.body;
    
    if (!Array.isArray(invalidCookies)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'invalidCookies必须是一个数组'
      });
    }
    
    // 获取当前无效cookie集合
    const currentInvalidCookies = keyManager.getInvalidCookies();
    
    // 添加新的无效cookie
    for (const cookie of invalidCookies) {
      if (typeof cookie === 'string' && cookie.trim()) {
        currentInvalidCookies.add(cookie.trim());
      }
    }
    
    // 保存到文件
    keyManager.saveInvalidCookiesToFile();
    
    return res.json({
      success: true,
      message: `已添加${invalidCookies.length}个无效cookie`
    });
  } catch (error) {
    logger.error('添加无效cookie失败:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 获取可用模型列表
router.get("/models", async (req, res) => {
  try{
    let bearerToken = req.headers.authorization?.replace('Bearer ', '');
    
    // 使用keyManager获取实际的cookie
    let authToken = keyManager.getCookieForApiKey(bearerToken);
    
    if (authToken && authToken.includes('%3A%3A')) {
      authToken = authToken.split('%3A%3A')[1];
    }
    else if (authToken && authToken.includes('::')) {
      authToken = authToken.split('::')[1];
    }

    const checksum = req.headers['x-cursor-checksum']
      ?? process.env['x-cursor-checksum']
      ?? generateCursorChecksum(authToken.trim());
    //const cursorClientVersion = "0.45.11"
    const cursorClientVersion = "0.50.4";

    const availableModelsResponse = await fetch("https://api2.cursor.sh/aiserver.v1.AiService/AvailableModels", {
      method: 'POST',
      headers: {
        'accept-encoding': 'gzip',
        'authorization': `Bearer ${authToken}`,
        'connect-protocol-version': '1',
        'content-type': 'application/proto',
        'user-agent': 'connect-es/1.6.1',
        'x-cursor-checksum': checksum,
        'x-cursor-client-version': cursorClientVersion,
        'x-cursor-config-version': uuidv4(),
        'x-cursor-timezone': 'Asia/Tokyo',
        'x-ghost-mode': 'true',
        'Host': 'api2.cursor.sh',
      },
    })
    const data = await availableModelsResponse.arrayBuffer();
    const buffer = Buffer.from(data);
    try{
      const models = $root.AvailableModelsResponse.decode(buffer).models;

      // 生成带前缀的模型列表
      const prefixedModels = models.map(model => ({
        id: `[auto]-${model.name}`,
        created: Date.now(),
        object: 'model',
        owned_by: 'cursor'
      }));

      // 合并原始模型和带前缀的模型
      const combinedModels = models.map(model => ({
        id: model.name,
        created: Date.now(),
        object: 'model',
        owned_by: 'cursor'
      })).concat(prefixedModels);

      return res.json({
        object: "list",
        data: combinedModels
      })
    } catch (error) {
      const text = buffer.toString('utf-8');
      throw new Error(text);
    }
  }
  catch (error) {
    logger.error(error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
})


router.post('/chat/completions', async (req, res) => {
  // 检查请求体是否存在
  if (!req.body) {
    return res.status(400).json({
      error: '请求体不能为空',
    });
  }

  // 检查模型属性是否存在
  if (!req.body.model) {
    return res.status(400).json({
      error: '缺少必要参数: model',
    });
  }

  // 检查未支持的模型和流式传输 (对原始模型进行检查)
  if (typeof req.body.model === 'string' && req.body.model.replace('[auto]-', '').startsWith('o1-') && req.body.stream) {
    return res.status(400).json({
      error: 'Model not supported stream',
    });
  }

  try {
    const { model, messages, stream = false } = req.body;
    let extractedStopTokens = [];
    let processedMessages = JSON.parse(JSON.stringify(messages)); // 复制一份，避免修改原始请求体
    let foundStopStringPattern = false;

    let actualModel = model; // 实际发送给Cursor的模型名称
    const autoPrefix = '[auto]-';

    // 检查并处理带前缀的模型
    if (typeof model === 'string' && model.startsWith(autoPrefix)) {
      actualModel = model.substring(autoPrefix.length); // 移除前缀
      logger.info(`检测到预定模板模型: ${model}, 实际使用模型: ${actualModel}`);

      // 定义模板和随机标签
      const template = `
<|Stop-String|><In-The-End>::<S-top>::<The-End>::<stop-string>::<stop-str>::<stop-word>::<STOP-s><|Stop-String|>
###Please ensure to output the following stop string wrapped in xml tag {{random}} at the end of each reply:

Ending this round of conversation: Ten, nine, eight, seven, six, five, four, three, two, one. This round of replies has been perfectly completed!
`;
      const tags = ['<In-The-End>', '<S-top>', '<The-End>', '<stop-string>', '<stop-str>', '<stop-word>', '<STOP-s>'];

      // 1. 随机选择一个标签，确保本次请求中所有注入都使用这一个
      const randomTag = tags[Math.floor(Math.random() * tags.length)];

      // 2. 构建注入系统消息的指令
      const processedTemplate = template.replace('{{random}}', randomTag);

      // 3. 构建追加到assistant消息的声明
      const declarationString = `
${randomTag}
Ending this round of conversation: Ten, nine, eight, seven, six, five, four, three, two, one. This round of replies has been perfectly completed!
${randomTag.replace('<', '</')}
`;

      // 4. 将指令注入到系统消息中 (不存在则创建)
      let systemMessage = processedMessages.find(m => m.role === 'system');
      if (systemMessage) {
        systemMessage.content = (systemMessage.content || '') + '\n\n' + processedTemplate;
        logger.debug('已将模板追加到现有系统消息');
      } else {
        processedMessages.unshift({ role: 'system', content: processedTemplate });
        logger.debug('未找到系统消息，已创建并添加新的系统消息');
      }

      // 5. 将声明追加到最后5条assistant消息
      let assistantMessagesToModify = 5;
      for (let i = processedMessages.length - 1; i >= 0 && assistantMessagesToModify > 0; i--) {
        if (processedMessages[i].role === 'assistant') {
          processedMessages[i].content = (processedMessages[i].content || '') + declarationString;
          assistantMessagesToModify--;
        }
      }
      logger.debug(`已将声明追加到 ${5 - assistantMessagesToModify} 条assistant消息`);

       // 在处理完预设模板后，确保foundStopStringPattern为false，以便后续的停止字符串提取逻辑能够运行在processedMessages上
       foundStopStringPattern = false; // 重置foundStopStringPattern
    }

    // 从messages中提取停止字符串并移除标记 (现在会作用于可能修改过的processedMessages)
    for (const message of processedMessages) {
      let content = message.content || '';
      const stopStringPattern = /<\|Stop-String\|>(.*?)<\|Stop-String\|>/s;
      const match = content.match(stopStringPattern);

      if (match && match[1] && !foundStopStringPattern) {
        // 只处理找到的第一个匹配
        const stopStrings = match[1].split('::').map(s => s.trim()).filter(s => s.length > 0);
        extractedStopTokens = stopStrings;
        foundStopStringPattern = true;

        // 移除content中的停止字符串标记
        content = content.replace(stopStringPattern, '').trim();

        // 如果移除后内容为空，考虑删除该消息或保留角色信息
        if (content === '') {
            // Option 1: Keep role but empty content, prevents removing valid turn.
             message.content = ''; // 直接修改processedMessages中的对象
            // Option 2: Remove message entirely if content becomes empty.
            // continue; // 这需要重建processedMessages数组
        } else {
             message.content = content; // 直接修改processedMessages中的对象
        }
      } else if (foundStopStringPattern) {
         // 如果已经找到模式，直接使用原始内容，不再进行移除操作
         // message.content 保持不变
      }
    }

    // 如果没有找到停止字符串模式，返回错误 (现在只有在没有[auto]-前缀模型且没有找到标记时才会触发)
    // 对于[auto]-前缀模型，由于模板中包含了标记，foundStopStringPattern会被设置为true
    if (!foundStopStringPattern) {
      return res.json({
        id: `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'unknown',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '预设错误，请使用指定预设结构',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      });
    }

    // 使用提取的停止字符串
    const stopTokens = extractedStopTokens;

    // 记录本次回复的所有停止字符串
    logger.info(`本次回复使用的停止字符串: [${stopTokens.join(', ')}]`);

    let bearerToken = req.headers.authorization?.replace('Bearer ', '');

    // 使用keyManager获取实际的cookie
    let authToken = keyManager.getCookieForApiKey(bearerToken);
    // 保存原始cookie，用于后续可能的错误处理
    const originalAuthToken = authToken;
    //console.log('原始cookie:', originalAuthToken);

    if (authToken && authToken.includes('%3A%3A')) {
      authToken = authToken.split('%3A%3A')[1];
    }
    else if (authToken && authToken.includes('::')) {
      authToken = authToken.split('::')[1];
    }

    // 使用processedMessages (可能包含追加的模板)
    if (!processedMessages || processedMessages.length === 0 || !authToken) {
      return res.status(400).json({
        error: 'Invalid request. Messages should be a non-empty array and authorization is required',
      });
    }

    const checksum = req.headers['x-cursor-checksum']
      ?? process.env['x-cursor-checksum']
      ?? generateCursorChecksum(authToken.trim());

    const sessionid = uuidv5(authToken,  uuidv5.DNS);
    const clientKey = generateHashed64Hex(authToken);
    const cursorClientVersion = "0.50.4";

    // 在请求聊天接口前，依次调用6个接口
    if (process.env.USE_OTHERS === 'true') {
      try{
        others(authToken, clientKey, checksum, cursorClientVersion, sessionid).then( () => {
          logger.info("其它接口异步调用成功");
        });
      } catch (error) {
        logger.error(error.message);
      }
    }

    // 使用实际发送给Cursor的模型名称 (不带前缀)
    logger.info('发送给Cursor的完整消息上下文:', JSON.stringify(processedMessages, null, 2));
    logger.info('发送给Cursor的实际模型:', actualModel);
    const cursorBody = generateCursorBody(processedMessages, actualModel);

    // 添加代理支持
    const dispatcher = config.proxy && config.proxy.enabled
      ? new ProxyAgent(config.proxy.url, { allowH2: true })
      : new Agent({ allowH2: true });

    // 根据.env配置决定是否使用TLS代理
    const useTlsProxy = process.env.USE_TLS_PROXY === 'true';

    // 创建AbortController用于能够中止请求
    const controller = new AbortController();
    const signal = controller.signal;

    let response;

    try {
      if (useTlsProxy) {
        // 使用JA3指纹伪造代理服务器
        logger.info(`使用TLS代理服务器`);
        response = await fetch('http://localhost:8080/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: 'https://api2.cursor.sh/aiserver.v1.ChatService/StreamUnifiedChatWithTools',
            method: 'POST',
            headers: {
              'authorization': `Bearer ${authToken}`,
              'connect-accept-encoding': 'gzip',
              'connect-content-encoding': 'gzip',
              'connect-protocol-version': '1',
              'content-type': 'application/connect+proto',
              'user-agent': 'connect-es/1.6.1',
              'x-amzn-trace-id': `Root=${uuidv4()}`,
              'x-client-key': clientKey,
              'x-cursor-checksum': checksum,
              'x-cursor-client-version': cursorClientVersion,
              'x-cursor-config-version': uuidv4(),
              'x-cursor-timezone': 'Asia/Tokyo',
              'x-ghost-mode': 'true',
              'x-request-id': uuidv4(),
              'x-session-id': sessionid,
              'Host': 'api2.cursor.sh',
            },
            body: cursorBody,
            stream: true // 启用流式响应
          }),
          timeout: {
            connect: 5000,
            read: 30000
          },
          signal // 添加AbortController的signal
        });
      } else {
        // 直接调用API，不使用TLS代理
        logger.info('不使用TLS代理服务器，直接请求API');
        response = await fetch('https://api2.cursor.sh/aiserver.v1.ChatService/StreamUnifiedChatWithTools', {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${authToken}`,
            'connect-accept-encoding': 'gzip',
            'connect-content-encoding': 'gzip',
            'connect-protocol-version': '1',
            'content-type': 'application/connect+proto',
            'user-agent': 'connect-es/1.6.1',
            'x-amzn-trace-id': `Root=${uuidv4()}`,
            'x-client-key': clientKey,
            'x-cursor-checksum': checksum,
            'x-cursor-client-version': cursorClientVersion,
            'x-cursor-config-version': uuidv4(),
            'x-cursor-timezone': 'Asia/Shanghai',
            'x-ghost-mode': 'true',
            'x-request-id': uuidv4(),
            'x-session-id': sessionid,
            'Host': 'api2.cursor.sh',
          },
          body: cursorBody,
          dispatcher: dispatcher,
          timeout: {
            connect: 5000,
            read: 30000
          },
          signal // 添加AbortController的signal
        });
      }
    } catch (fetchError) {
      logger.error(`Fetch错误: ${fetchError.message}`);

      // 处理连接超时错误
      const isConnectTimeout = fetchError.cause &&
                             (fetchError.cause.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                              fetchError.message.includes('Connect Timeout Error'));

      // 构建错误响应
      const errorMessage = isConnectTimeout
        ? `⚠️ 连接超时 ⚠️\\n\\n无法连接到API服务器(api2.cursor.sh)，请检查您的网络连接或尝试使用代理。`
        : `⚠️ 请求失败 ⚠️\\n\\n错误: ${fetchError.message}`;

      if (stream) {
        // 流式响应格式的错误
        const responseId = `chatcmpl-${uuidv4()}`;
        res.write(
          `data: ${JSON.stringify({
            id: responseId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: req.body.model || 'unknown',
            choices: [
              {
                index: 0,
                delta: {
                  content: errorMessage,
                },
              },
            ],
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // 非流式响应格式的错误
        res.json({
          id: `chatcmpl-${uuidv4()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: req.body.model || 'unknown',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: errorMessage,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        });
      }
      return; // 重要：提前返回
    }

    // 处理响应
    if (stream) {
      // 如果存在此 API Key 的旧请求，则中止它
      if (bearerToken && activeRequestControllers.has(bearerToken)) {
        const oldController = activeRequestControllers.get(bearerToken);
        logger.info(`API Key [${bearerToken}] 的新流式请求到达，正在中止旧请求...`);
        oldController.abort();
        // activeRequestControllers.delete(bearerToken); // 旧的会被新的覆盖，或在旧请求的清理逻辑中移除
      }
      // 存储当前请求的 AbortController
      if (bearerToken) {
        activeRequestControllers.set(bearerToken, controller);
      }

      // 清理当前请求的 AbortController 的辅助函数
      const cleanupCurrentController = () => {
        if (bearerToken && activeRequestControllers.get(bearerToken) === controller) {
          activeRequestControllers.delete(bearerToken);
          logger.debug(`API Key [${bearerToken}] 的流式请求处理完毕，已清理 AbortController。`);
        }
      };
      res.on('finish', cleanupCurrentController); // 响应正常结束时清理
      res.on('close', cleanupCurrentController);  // 响应因任何原因关闭时清理 (包括客户端断开)

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 监听客户端断开连接事件
      req.on('close', () => {
        if (!responseEnded) {
          logger.warn(`客户端已断开连接 (API Key: [${bearerToken}]), 正在中止对Cursor服务端的请求...`);
          controller.abort();
          responseEnded = true;
          // cleanupCurrentController 会在 res 'close' 时被调用
        }
      });

      const responseId = `chatcmpl-${uuidv4()}`;

      let isThinking_status = 0; //0为没有思考，1为处于思考状态
      try {
        let responseEnded = false; // 添加标志，标记响应是否已结束
        let hasWrittenThinkingStart = false; // 标记是否已发送thinking开始标签
        let hasWrittenThinkingEnd = false; // 标记是否已发送thinking结束标签
        let hasWrittenContent = false; // 标记是否已发送content
        let accumulatedThinking = ''; // 累积thinking内容
        let accumulatedContent = ''; // 累积content内容

        for await (const chunk of response.body) {
          // 如果响应已结束，不再处理后续数据
          if (responseEnded) {
            continue;
          }

          let result = {};
          try {
            result = chunkToUtf8String(chunk);
          } catch (error) {
            logger.error('解析响应块失败:', error);
            // 提供默认的空结果，避免后续处理出错
            result = {
              isThink: false,
              thinkingContent: '',
              content: '',
              error: `解析错误: ${error.message}`
            };
          }

          // 检查是否返回了错误对象
          if (result && typeof result === 'object' && result.error) {
            // 检查是否包含特定的无效cookie错误信息
            const errorStr = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);

            // 处理错误并获取结果
            const errorResult = handleCursorError(errorStr, bearerToken, originalAuthToken);

            // 如果是需要移除的cookie，从API Key中移除
            if (errorResult.shouldRemoveCookie) {
              const removed = keyManager.removeCookieFromApiKey(bearerToken, originalAuthToken);
              logger.info(`Cookie移除${removed ? '成功' : '失败'}`);

              // 如果成功移除，在错误消息中添加明确提示
              if (removed) {
                errorResult.message = `⚠️ 目前Cookie已从API Key中移除 ⚠️\\n\\n${errorResult.message}`;
              }
            }

            // 返回错误信息给客户端，作为assistant消息
            res.write(
              `data: ${JSON.stringify({
                id: responseId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: req.body.model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: errorResult.message,
                    },
                  },
                ],
              })}\n\n`
            );

            res.write('data: [DONE]\n\n');
            responseEnded = true; // 标记响应已结束
            break; // 跳出循环，不再处理后续数据
          }

          // 处理thinking内容
          if (result.isThink && result.thinkingContent && result.thinkingContent.length > 0) {
            // 累积thinking内容
            accumulatedThinking += result.thinkingContent;

            // 如果没有发送thinking开始标记，则发送
            if (!hasWrittenThinkingStart) {
              res.write(
                `data: ${JSON.stringify({
                  id: responseId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: req.body.model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        content: "<think>\\n",
                      },
                    },
                  ],
                })}\n\n`
              );
              hasWrittenThinkingStart = true;
            }

            // 发送accumulated thinking内容片段
            res.write(
              `data: ${JSON.stringify({
                id: responseId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: req.body.model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: result.thinkingContent,
                    },
                  },
                ],
              })}\n\n`
            );
          }

          // 处理常规内容
          if (result.content && result.content.length > 0) {
            // 累积content内容
            accumulatedContent += result.content;

            // 如果已经有thinking内容，且尚未发送thinking结束标记，则发送
            if (hasWrittenThinkingStart && !hasWrittenThinkingEnd) {
              res.write(
                `data: ${JSON.stringify({
                  id: responseId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: req.body.model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        content: "\\n</think>\\n",
                      },
                    },
                  ],
                })}\n\n`
              );
              hasWrittenThinkingEnd = true;
            }

            // 检查是否遇到停止字符串
            let shouldStop = false;
            let contentToSend = result.content;

            // 检查停止字符串
            if (stopTokens.length > 0) {
              for (const stopToken of stopTokens) {
                const stopIndex = accumulatedContent.indexOf(stopToken);
                if (stopIndex !== -1) {
                  // 记录检测到停止字符串的日志
                  logger.info(`检测到停止字符串: "${stopToken}" 在位置 ${stopIndex}，累积内容长度: ${accumulatedContent.length}`);

                  // 如果找到停止字符串，立即停止，不管停止字符串在哪个chunk中
                  const lastChunkIndex = accumulatedContent.length - result.content.length;

                  if (stopIndex >= lastChunkIndex) {
                    // 停止字符串在当前块中，只发送到停止字符串之前的内容
                    contentToSend = result.content.substring(0, stopIndex - lastChunkIndex);
                  } else {
                    // 停止字符串在之前的chunks中，不发送当前chunk的任何内容
                    contentToSend = '';
                  }

                  shouldStop = true;
                  break;
                }
              }
            }

            // 只有当有内容要发送时才发送
            if (contentToSend.length > 0) {
              // 发送content内容
              res.write(
                `data: ${JSON.stringify({
                  id: responseId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: req.body.model,
                  choices: [
                    {
                      index: 0,
                      delta: {
                        content: contentToSend,
                      },
                    },
                  ],
                })}\n\n`
              );
              hasWrittenContent = true;
            }

            // 如果需要停止，发送[DONE]并结束响应
            if (shouldStop) {
              res.write('data: [DONE]\n\n');
              res.end();
              responseEnded = true;

              try {
                controller.abort();
              } catch (abortError) {
                logger.error('中止Cursor连接时出错 (停止字符串):', abortError);
              }
              // cleanupCurrentController 会在 res 'finish' 或 'close' 时被调用
              break;
            }
          }
        }

        // 处理结束逻辑：确保thinking标签被正确关闭
        if (!responseEnded) {
          // 如果有thinking内容但没有发送结束标记，则发送
          if (hasWrittenThinkingStart && !hasWrittenThinkingEnd) {
            res.write(
              `data: ${JSON.stringify({
                id: responseId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: req.body.model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: "\\n</think>\\n",
                    },
                  },
                ],
              })}\n\n`
            );
          }

          res.write('data: [DONE]\n\n');
          res.end();
          // cleanupCurrentController 会在 res 'finish' 时被调用
        }
      } catch (streamError) {
        // 区分正常的中止操作和真正的错误
        if (streamError.name === 'AbortError') {
          logger.info(`流处理被中止 (API Key: [${bearerToken}]), 原因可能为: 新请求覆盖, 客户端断开, 或停止字符串触发。`);
        } else {
          logger.error(`Stream error (API Key: [${bearerToken}]):`, streamError);
        }

        if (!res.writableEnded) {
          if (streamError.name === 'AbortError') {
            // AbortError 通常意味着我们主动中止，响应可能已处理或将由 'close' 事件处理
            // 但为确保万无一失，如果响应未结束，尝试结束它
            if (!res.headersSent) { // 避免在已发送头后再次发送
                res.status(500).json({ error: 'Stream aborted' });
            } else {
                res.end(); //尝试结束流
            }
            return; // AbortError 处理完毕
          } else if (streamError.name === 'TimeoutError') {
            // 将超时错误作为assistant消息发送
            const errorMessage = `⚠️ 请求超时 ⚠️\\n\\n错误：服务器响应超时，请稍后重试。`;
            res.write(
              `data: ${JSON.stringify({
                id: responseId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: req.body.model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: errorMessage,
                    },
                  },
                ],
              })}\n\n`
            );
          } else {
            // 将处理错误作为assistant消息发送
            const errorMessage = `⚠️ 处理错误 ⚠️\\n\\n错误：流处理出错，请稍后重试。\\n\\n${streamError.message || ''}`;
            res.write(
              `data: ${JSON.stringify({
                id: responseId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: req.body.model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      content: errorMessage,
                    },
                  },
                ],
              })}\n\n`
            );
          }
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    } else {
      try {
        let text = '';
        let thinkingText = '';
        let hasThinking = false;
        let responseEnded = false; // 添加标志，标记响应是否已结束

        for await (const chunk of response.body) {
          // 如果响应已结束，不再处理后续数据
          if (responseEnded) {
            continue;
          }

          let result = {};
          try {
            result = chunkToUtf8String(chunk);
          } catch (error) {
            logger.error('非流式响应解析块失败:', error);
            // 提供默认的空结果，避免后续处理出错
            result = {
              thinkingContent: '',
              content: '',
              error: `解析错误: ${error.message}`
            };
          }
          // 输出完整的result内容和类型，便于调试
          //console.log("收到的非流式响应:", typeof result, result && typeof result === 'object' ? JSON.stringify(result) : result);

          // 检查是否返回了错误对象
          if (result && typeof result === 'object' && result.error) {
            //console.error('检测到错误响应:', result.error);

            // 检查是否包含特定的无效cookie错误信息
            const errorStr = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);

            // 处理错误并获取结果
            const errorResult = handleCursorError(errorStr, bearerToken, originalAuthToken);

            // 如果是需要移除的cookie，从API Key中移除
            if (errorResult.shouldRemoveCookie) {
              const removed = keyManager.removeCookieFromApiKey(bearerToken, originalAuthToken);
              logger.info(`Cookie移除${removed ? '成功' : '失败'}`);

              // 如果成功移除，在错误消息中添加明确提示
              if (removed) {
                errorResult.message = `⚠️ 目前Cookie已从API Key中移除 ⚠️\\n\\n${errorResult.message}`;
              }
            }

            // 无效cookie错误，格式化为assistant消息
            res.json({
              id: `chatcmpl-${uuidv4()}`,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: errorResult.message,
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
              },
            });

            responseEnded = true; // 标记响应已结束
            break; // 跳出循环，不再处理后续数据
          }

          // 处理thinking内容
          if (result.thinkingContent && result.thinkingContent.length > 0) {
            thinkingText += result.thinkingContent;
            hasThinking = true;
          }

          // 处理正常文本内容
          if (result.content && typeof result.content === 'string') {
            text += result.content;
          }
        }

        // 只有在响应尚未结束的情况下，才处理和返回结果
        if (!responseEnded) {
          // 对解析后的字符串进行进一步处理
          text = text.replace(/^.*<\|END_USER\|>/s, '');
          text = text.replace(/^\n[a-zA-Z]?/, '').trim();

          // 检查停止字符串并截断内容
          if (stopTokens.length > 0) {
            for (const stopToken of stopTokens) {
              const stopIndex = text.indexOf(stopToken);
              if (stopIndex !== -1) {
                // 记录检测到停止字符串的日志
                logger.info(`非流式响应检测到停止字符串: "${stopToken}" 在位置 ${stopIndex}`);

                // 截断到停止字符串之前的内容
                text = text.substring(0, stopIndex);
                break;
              }
            }
          }

          // 如果存在thinking内容，添加标签
          let finalContent = text;
          if (hasThinking && thinkingText.length > 0) {
            finalContent = `<think>\\n${thinkingText}\\n</think>\\n${text}`;
          }

          res.json({
            id: `chatcmpl-${uuidv4()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: finalContent,
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            },
          });
        }
      } catch (error) {
        logger.error('Non-stream error:', error);
        // 确保在发送错误信息前检查响应是否已结束
        if (!res.headersSent) {
          if (error.name === 'TimeoutError') {
            // 使用统一的错误格式
            const errorMessage = `⚠️ 请求超时 ⚠️\\n\\n错误：服务器响应超时，请稍后重试。`;
            return res.json({
              id: `chatcmpl-${uuidv4()}`,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: req.body.model || 'unknown',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: errorMessage,
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
              },
            });
          }
          throw error;
        }
      }
    }
  } catch (error) {
    logger.error('Error:', error);
    if (!res.headersSent) {
      const errorText = error.name === 'TimeoutError' ? '请求超时' : '服务器内部错误';

      if (req.body.stream) {
        // 流式响应格式的错误
        const responseId = `chatcmpl-${uuidv4()}`;
        // 添加清晰的错误提示
        const errorMessage = `⚠️ 请求失败 ⚠️\\n\\n错误：${errorText}，请稍后重试。\\n\\n${error.message || ''}`;
        res.write(
          `data: ${JSON.stringify({
            id: responseId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: req.body.model || 'unknown',
            choices: [
              {
                index: 0,
                delta: {
                  content: errorMessage,
                },
              },
            ],
          })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // 非流式响应格式的错误
        // 添加清晰的错误提示
        const errorMessage = `⚠️ 请求失败 ⚠️\\n\\n错误：${errorText}，请稍后重试。\\n\\n${error.message || ''}`;
        res.json({
          id: `chatcmpl-${uuidv4()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: req.body.model || 'unknown',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: errorMessage,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        });
      }
    }
  }
});

// 触发Cookie刷新
router.post("/refresh-cookies", async (req, res) => {
  try {
    // 如果已经有刷新进程在运行，则返回错误
    if (refreshStatus.isRunning) {
      return res.status(409).json({
        success: false,
        message: '已有刷新进程在运行，请等待完成后再试'
      });
    }
    
    // 获取请求参数
    const apiKey = req.query.apiKey || '';
    
    // 重置刷新状态
    refreshStatus = {
      isRunning: true,
      status: 'running',
      message: '正在启动刷新进程...',
      startTime: new Date(),
      endTime: null,
      error: null
    };
    
    logger.info(`收到刷新Cookie请求，API Key: ${apiKey || '所有'}`);
    
    // 构建命令行参数
    const args = [];
    if (apiKey) {
      args.push(apiKey);
    }
    
    // 获取auto-refresh-cookies.js的绝对路径
    const scriptPath = path.resolve(__dirname, '../../auto-refresh-cookies.js');
    
    // 启动子进程执行刷新脚本
    const refreshProcess = spawn('node', [scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // 收集输出
    let output = '';
    
    refreshProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      logger.info(`刷新进程输出: ${text}`);
      
      // 更新状态消息
      if (text.includes('开始自动刷新')) {
        refreshStatus.message = '正在刷新Cookie...';
      } else if (text.includes('刷新结果:')) {
        refreshStatus.message = text.trim();
      }
    });
    
    refreshProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      logger.error(`刷新进程错误: ${text}`);
      
      // 更新错误信息
      refreshStatus.error = text.trim();
      refreshStatus.message = `发生错误: ${text.trim()}`;
    });
    
    refreshProcess.on('close', (code) => {
      logger.info(`刷新进程退出，代码: ${code}`);
      
      refreshStatus.isRunning = false;
      refreshStatus.endTime = new Date();
      
      if (code === 0) {
        refreshStatus.status = 'completed';
        
        // 提取成功信息
        const successMatch = output.match(/成功刷新 (\d+) 个/);
        if (successMatch) {
          refreshStatus.message = `成功刷新 ${successMatch[1]} 个API Key的Cookie`;
        } else {
          refreshStatus.message = '刷新完成';
        }
        
        // 子进程执行完成后，重新初始化API Keys来加载新的Cookie
        try {
          const keyManager = require('../utils/keyManager');
          logger.info('子进程刷新Cookie完成，重新初始化主进程中的API Keys...');
          keyManager.initializeApiKeys();
          logger.info('主进程API Keys重新加载完成');
        } catch (initError) {
          logger.error('重新初始化API Keys失败:', initError);
        }
      } else {
        refreshStatus.status = 'failed';
        refreshStatus.message = refreshStatus.error || '刷新失败，请查看服务器日志';
      }
    });
    
    // 立即返回响应，不等待刷新完成
    return res.json({
      success: true,
      message: '刷新请求已接受，正在后台处理'
    });
  } catch (error) {
    logger.error('触发刷新Cookie失败:', error);
    
    // 更新刷新状态
    refreshStatus.isRunning = false;
    refreshStatus.status = 'failed';
    refreshStatus.endTime = new Date();
    refreshStatus.error = error.message;
    refreshStatus.message = `触发刷新失败: ${error.message}`;
    
    return res.status(500).json({
      success: false,
      message: `触发刷新失败: ${error.message}`
    });
  }
});

// 查询Cookie刷新状态
router.get("/refresh-status", (req, res) => {
  try {
    // 返回当前刷新状态
    return res.json({
      success: true,
      data: {
        ...refreshStatus,
        isRunning: refreshStatus.isRunning || false,
        status: refreshStatus.status || 'unknown',
        message: refreshStatus.message || '未触发刷新',
        startTime: refreshStatus.startTime || null,
        endTime: refreshStatus.endTime || null
      }
    });
  } catch (error) {
    logger.error('获取刷新状态失败:', error);
    return res.status(500).json({
      success: false,
      message: `获取刷新状态失败: ${error.message}`
    });
  }
});

// 生成获取Cookie的链接
router.post('/generate-cookie-link', async (req, res) => {
  try {
    // 验证管理员权限
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供认证token'
      });
    }
    
    const token = authHeader.split(' ')[1];
    const authResult = admin.verifyToken(token);
    
    if (!authResult.success) {
      return res.status(401).json({
        success: false,
        message: '认证失败'
      });
    }
    
    // 生成UUID和PKCE验证器
    const uuid = uuidv4();
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

    // 生成登录链接
    const loginUrl = `https://www.cursor.com/ja/loginDeepControl?challenge=${challenge}&uuid=${uuid}&mode=login`;
    
    // 记录请求信息
    pendingCookieRequests.set(uuid, {
      uuid,
      verifier,
      status: 'waiting',
      created: Date.now(),
      apiKey: req.body.apiKey || '', // 目标API Key，空字符串表示所有API Key
      lastCheck: Date.now(),
      cookie: null
    });
    
    // 设置60分钟后自动清理
    setTimeout(() => {
      if (pendingCookieRequests.has(uuid)) {
        pendingCookieRequests.delete(uuid);
      }
    }, 60 * 60 * 1000);
    
    return res.json({
      success: true,
      url: loginUrl,
      uuid: uuid
    });
  } catch (error) {
    logger.error('生成Cookie链接失败:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 查询Cookie获取状态
router.get('/check-cookie-status', async (req, res) => {
  try {
    const { uuid } = req.query;
    
    if (!uuid || !pendingCookieRequests.has(uuid)) {
      return res.json({
        success: false,
        status: 'failed',
        message: '无效的UUID或请求已过期'
      });
    }
    
    const request = pendingCookieRequests.get(uuid);
    request.lastCheck = Date.now();
    
    // 检查状态
    if (request.status === 'waiting') {
      // 检查Cursor API获取token
      try {
        const apiUrl = `https://api2.cursor.sh/auth/poll?uuid=${uuid}&verifier=${request.verifier}`;
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.6834.210 Safari/537.36',
            'Accept': '*/*',
            'Origin': 'vscode-file://vscode-app',
            'x-ghost-mode': 'true'
          },
          timeout: 5000
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && data.accessToken) {
            // 获取到了Cookie
            request.cookie = data.accessToken;
            request.status = 'success';
            
            // 将Cookie添加到目标API Key
            let message = '';
            
            if (request.apiKey) {
              // 添加到特定API Key
              const apiKey = request.apiKey;
              const cookies = keyManager.getAllCookiesForApiKey(apiKey) || [];
              cookies.push(request.cookie);
              keyManager.addOrUpdateApiKey(apiKey, cookies);
              message = `Cookie已添加到API Key: ${apiKey}`;
            } else {
              // 添加到所有API Key
              const apiKeys = keyManager.getAllApiKeys();
              for (const apiKey of apiKeys) {
                const cookies = keyManager.getAllCookiesForApiKey(apiKey) || [];
                cookies.push(request.cookie);
                keyManager.addOrUpdateApiKey(apiKey, cookies);
              }
              message = `Cookie已添加到所有API Key，共${apiKeys.length}个`;
            }
            
            // 完成后从等待列表中移除
            pendingCookieRequests.delete(uuid);
            
            return res.json({
              success: true,
              message: message
            });
          }
        }
        
        // 如果没有获取到Cookie，继续等待
        return res.json({
          success: false,
          status: 'waiting'
        });
        
      } catch (error) {
        logger.error('查询Cursor API失败:', error);
        // 发生错误但继续等待，不改变状态
        return res.json({
          success: false,
          status: 'waiting',
          message: '轮询过程中出现错误，继续等待'
        });
      }
    } else if (request.status === 'success') {
      // 已成功，返回结果
      const message = request.apiKey 
        ? `Cookie已添加到API Key: ${request.apiKey}`
        : `Cookie已添加到所有API Key`;
      
      // 完成后从等待列表中移除
      pendingCookieRequests.delete(uuid);
      
      return res.json({
        success: true,
        message: message
      });
    } else {
      // 失败
      pendingCookieRequests.delete(uuid);
      return res.json({
        success: false,
        status: 'failed',
        message: '获取Cookie失败'
      });
    }
  } catch (error) {
    logger.error('检查Cookie状态失败:', error);
    return res.status(500).json({
      success: false,
      status: 'failed',
      message: error.message
    });
  }
});

// 获取日志API
router.get("/logs", (req, res) => {
  try {
    // 获取查询参数
    const level = req.query.level;
    const search = req.query.search;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 100;
    const startTime = req.query.startTime;
    const endTime = req.query.endTime;
    
    // 过滤参数
    const filter = {
      level,
      search,
      page,
      pageSize,
      startTime,
      endTime
    };
    
    // 获取日志
    const logs = logger.getLogs(filter);
    
    return res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    logger.error('获取日志失败:', error);
    return res.status(500).json({
      success: false,
      message: `获取日志失败: ${error.message}`
    });
  }
});

// 清除内存日志
router.delete("/logs", (req, res) => {
  try {
    logger.clearMemoryLogs();
    return res.json({
      success: true,
      message: '日志已清除'
    });
  } catch (error) {
    logger.error('清除日志失败:', error);
    return res.status(500).json({
      success: false,
      message: `清除日志失败: ${error.message}`
    });
  }
});
async function others(authToken, clientKey, checksum, cursorClientVersion, sessionid){
  try {
    // 定义所有API端点配置
    const endpoints = [
      {
        url: 'https://api2.cursor.sh/aiserver.v1.AiService/CheckFeatureStatus',
        method: 'POST',
        headers: {
          'accept-encoding': 'gzip',
          'authorization': `Bearer ${authToken}`,
          'connect-protocol-version': '1',
          'content-type': 'application/proto',
          'user-agent': 'connect-es/1.6.1',
          'x-client-key': clientKey,
          'x-cursor-checksum': checksum,
          'x-cursor-client-version': cursorClientVersion,
          'x-cursor-config-version': uuidv4(),
          'x-cursor-timezone': 'Asia/Tokyo',
          'x-ghost-mode': 'true',
          'x-new-onboarding-completed': 'false',
          'x-session-id': sessionid,
          'Host': 'api2.cursor.sh',
        },
        body: '', // 实际长度为23字节
        timeout: {
          connect: 5000,
          read: 30000
        }
      },
      {
        url: 'https://api2.cursor.sh/aiserver.v1.AiService/AvailableDocs',
        method: 'POST',
        headers: {
          'authorization': `Bearer ${authToken}`,
          'connect-accept-encoding': 'gzip',
          'connect-protocol-version': '1',
          'content-type': 'application/proto',
          'user-agent': 'connect-es/1.6.1',
          'x-amzn-trace-id': `Root=${uuidv4()}`,
          'x-client-key': clientKey,
          'x-cursor-checksum': checksum,
          'x-cursor-client-version': cursorClientVersion,
          'x-cursor-config-version': uuidv4(),
          'x-cursor-timezone': 'Asia/Tokyo',
          'x-ghost-mode': 'true',
          'x-request-id': uuidv4(),
          'x-session-id': sessionid,
          'Host': 'api2.cursor.sh',
        },
        timeout: {
          connect: 5000,
          read: 30000
        }
      },
      {
        url: 'https://api2.cursor.sh/aiserver.v1.DashboardService/GetTeams',
        method: 'POST',
        headers: {
          'accept-encoding': 'gzip',
          'authorization': `Bearer ${authToken}`,
          'connect-protocol-version': '1',
          'content-type': 'application/proto',
          'user-agent': 'connect-es/1.6.1',
          'x-amzn-trace-id': `Root=${uuidv4()}`,
          'x-client-key': clientKey,
          'x-cursor-checksum': checksum,
          'x-cursor-client-version': cursorClientVersion,
          'x-cursor-config-version': uuidv4(),
          'x-cursor-timezone': 'Asia/Tokyo',
          'x-ghost-mode': 'true',
          'x-new-onboarding-completed': 'false',
          'x-request-id': uuidv4(),
          'x-session-id': sessionid,
          'Host': 'api2.cursor.sh',
        },
        body: '',
        timeout: {
          connect: 5000,
          read: 30000
        }
      },
      {
        url: 'https://api2.cursor.sh/auth/full_stripe_profile',
        method: 'GET',
        headers: {
          'Host': 'api2.cursor.sh',
          'Connection': 'keep-alive',
          'Authorization': `Bearer ${authToken}`,
          'x-new-onboarding-completed': 'false',
          'x-ghost-mode': 'true',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Cursor/0.49.4 Chrome/132.0.6834.210 Electron/34.3.4 Safari/537.36',
          'Accept': '*/*',
          'Origin': 'vscode-file://vscode-app',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Dest': 'empty',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'zh-CN'
        },
        timeout: {
          connect: 5000,
          read: 30000
        }
      },
      {
        url: 'https://api2.cursor.sh/aiserver.v1.DashboardService/GetUsageBasedPremiumRequests',
        method: 'POST',
        headers: {
          'accept-encoding': 'gzip',
          'authorization': `Bearer ${authToken}`,
          'connect-protocol-version': '1',
          'content-type': 'application/proto',
          'user-agent': 'connect-es/1.6.1',
          'x-client-key': clientKey,
          'x-cursor-checksum': checksum,
          'x-cursor-client-version': cursorClientVersion,
          'x-cursor-config-version': uuidv4(),
          'x-cursor-timezone': 'Asia/Tokyo',
          'x-ghost-mode': 'true',
          'x-new-onboarding-completed': 'false',
          'x-session-id': sessionid,
          'Host': 'api2.cursor.sh',
        },
        body: '',
        timeout: {
          connect: 5000,
          read: 30000
        }
      },
      {
        url: 'https://api2.cursor.sh/aiserver.v1.DashboardService/GetHardLimit',
        method: 'POST',
        headers: {
          'accept-encoding': 'gzip',
          'authorization': `Bearer ${authToken}`,
          'connect-protocol-version': '1',
          'content-type': 'application/proto',
          'user-agent': 'connect-es/1.6.1',
          'x-client-key': clientKey,
          'x-cursor-checksum': checksum,
          'x-cursor-client-version': cursorClientVersion,
          'x-cursor-config-version': uuidv4(),
          'x-cursor-timezone': 'Asia/Tokyo',
          'x-ghost-mode': 'true',
          'x-new-onboarding-completed': 'false',
          'x-session-id': sessionid,
          'Host': 'api2.cursor.sh',
        },
        body: '',
        timeout: {
          connect: 5000,
          read: 30000
        }
      }
    ];

    // 随机选择2-4个接口调用
    const minApis = 2;
    const maxApis = 4;
    const numApisToCall = Math.floor(Math.random() * (maxApis - minApis + 1)) + minApis;
    
    // 随机打乱数组并取前几个元素
    const shuffledEndpoints = [...endpoints].sort(() => 0.5 - Math.random()).slice(0, numApisToCall);
    
    // 使用Promise.allSettled确保即使一个请求失败也不会影响其他请求
    const results = await Promise.allSettled(shuffledEndpoints.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: endpoint.headers,
          body: endpoint.body || undefined,
          timeout: endpoint.timeout
        });
        
        return {
          url: endpoint.url,
          status: response.status,
          success: true
        };
      } catch (error) {
        // 记录单个请求的错误，但不中断整体流程
        logger.debug(`其它API调用失败 (${endpoint.url}): ${error.message}`);
        return {
          url: endpoint.url,
          success: false,
          error: error.message
        };
      }
    }));
    
    // 记录请求结果统计
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    logger.debug(`其它API调用完成: 成功 ${successCount}/${results.length}`);
    
    return true;
  } catch (error) {
    // 记录整体错误，但不影响主流程
    logger.error(`others函数执行出错: ${error.message}`);
    return false;
  }
}
// 在文件末尾添加错误处理函数
function handleCursorError(errorStr, bearerToken, originalAuthToken) {
  let message = '';
  let shouldRemoveCookie = false;
  
  if (errorStr.includes('Not logged in')) {
    // 更明确的错误日志
    if (originalAuthToken === bearerToken) {
      logger.error(`检测到API Key "${bearerToken}" 中没有可用Cookie，正在尝试以向后兼容模式使用API Key本身`);
      message = `错误：API Key "${bearerToken}" 中没有可用的Cookie。请添加有效的Cookie到此API Key，或使用其他有效的API Key。\\n\\n详细信息：${errorStr}`;
    } else {
      logger.error('检测到无效cookie:', originalAuthToken);
      message = `错误：Cookie无效或已过期，请更新Cookie。\\n\\n详细信息：${errorStr}`;
    }
    shouldRemoveCookie = true;
  } else if (errorStr.includes('You\'ve reached your trial request limit') || errorStr.includes('You\'ve reached the usage limit for free usage')) {
    logger.error('检测到额度用尽cookie:', originalAuthToken);
    message = `错误：Cookie使用额度已用完，请更换Cookie或等待刷新。\\n\\n详细信息：${errorStr}`;
    shouldRemoveCookie = true;
  } else if (errorStr.includes('User is unauthorized')) {
    logger.error('检测到未授权cookie:', originalAuthToken);
    message = `错误：Cookie已被封禁或失效，请更换Cookie。\\n\\n详细信息：${errorStr}`;
    shouldRemoveCookie = true;
  } else if (errorStr.includes('suspicious activity checks')) {
    logger.error('检测到IP黑名单:', originalAuthToken);
    message = `错误：IP可能被列入黑名单，请尝试更换网络环境或使用代理。\\n\\n详细信息：${errorStr}`;
    shouldRemoveCookie = false;
  } else if (errorStr.includes('Too many computers')) {
    logger.error('检测到账户暂时被封禁:', originalAuthToken);
    message = `错误：账户因在多台设备登录而暂时被封禁，请稍后再试或更换账户。\\n\\n详细信息：${errorStr}`;
    shouldRemoveCookie = true;
  } else if (errorStr.includes('Login expired') || errorStr.includes('login expired')) {
    logger.error('检测到登录过期cookie:', originalAuthToken);
    message = `错误：Cookie登录已过期，请更新Cookie。\\n\\n详细信息：${errorStr}`;
    shouldRemoveCookie = true;
  } else if(errorStr.includes('your request has been blocked due to the use of a temporary email service for this account')) {
    logger.error('检测到临时邮箱:', originalAuthToken);
    message = `错误：请求被阻止，检测到临时邮箱服务，请更换邮箱。\\n\\n详细信息：${errorStr}`;
    shouldRemoveCookie = true;
  } else if (errorStr.includes('Your request has been blocked as our system has detected suspicious activity from your account')) {
    logger.error('检测到账户异常:', originalAuthToken);
    message = `错误：请求被阻止，可能是假ban，多重试几次/更换cookie/更换设备。\\n\\n详细信息：${errorStr}`;
    shouldRemoveCookie = false;
  } else {
    // 非Cookie相关错误
    logger.error('检测到其他错误:', errorStr);
    message = `错误：请求失败。\\n\\n详细信息：${errorStr}`;
    shouldRemoveCookie = false;
  }
  
  return {
    message,
    shouldRemoveCookie
  };
}

module.exports = router;
