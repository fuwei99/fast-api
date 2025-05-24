# Cursor AI 配置指南

本文档详细说明了所有可用的Cursor配置选项，以及它们的用途和影响。

## 🚀 快速开始

1. 复制配置模板文件：
```bash
cp cursor-config.env.example cursor-config.env
```

2. 根据需要修改配置文件
3. 重启服务以应用配置：
```bash
npm start
```

## 📋 配置选项详解

### 🎯 核心模式设置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_MAX_MODE_ENABLED` | `true` | **MAX模式开关** - 启用增强AI能力，提供更深入的分析和建议 |
| `CURSOR_AGENT_MODE` | `true` | **Agent模式开关** - 启用智能代理功能，可以执行复杂的多步骤任务 |
| `CURSOR_UNIFIED_MODE` | `1` | **统一模式** - 整合多种功能模式，提供一致的用户体验 |
| `CURSOR_CHAT_MODE_ENUM` | `2` | **聊天模式枚举** - 控制对话交互的行为模式<br/>• `0`: 简单问答<br/>• `1`: 对话模式<br/>• `2`: 协作模式 |
| `CURSOR_CHAT_MODE` | `collaborative` | **聊天模式字符串** - 自定义聊天模式名称 |
| `CURSOR_PREPROCESSING_FLAG` | `false` | **预处理模式** - 是否在主要处理前进行环境初始化 |
| `CURSOR_STREAM_MODE` | `1` | **流式输出模式** - 控制响应是否实时流式输出<br/>• `0`: 关闭<br/>• `1`: 启用 |
| `CURSOR_THINKING_LEVEL` | `3` | **思考级别** - AI的思考深度等级 (0-5，数值越高思考越深入) |

### 🤖 模型配置选项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_MODEL_NAME` | `claude-4-sonnet-thinking` | **默认模型名称** - 指定使用的AI模型 |
| `CURSOR_STREAMING_ENABLED` | `true` | **启用流式响应** - 是否支持实时响应输出 |
| `CURSOR_MAX_TOKENS` | `4096` | **最大Token数量** - 单次对话的最大token限制 (影响响应长度) |
| `CURSOR_TEMPERATURE` | `0.7` | **创造性温度参数** - 控制AI响应的创造性<br/>• `0.0`: 最保守，结果一致<br/>• `1.0`: 平衡<br/>• `2.0`: 最有创意 |
| `CURSOR_THINKING_MODE` | `true` | **思考模式开关** - 是否显示AI的思考过程 |
| `CURSOR_THINKING_DEPTH` | `5` | **思考深度级别** - 思考过程的详细程度 (1-10) |

### 🛠️ Agent能力配置

#### 代码相关功能
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_CODE_UNDERSTANDING` | `true` | **代码理解能力** - 分析和理解现有代码的能力 |
| `CURSOR_CODE_GENERATION` | `true` | **代码生成能力** - 自动生成新代码的能力 |
| `CURSOR_CODE_REFACTORING` | `true` | **代码重构能力** - 优化和重构现有代码的能力 |
| `CURSOR_DEBUGGING_ASSISTANCE` | `true` | **调试辅助功能** - 帮助查找和修复代码错误 |
| `CURSOR_TEST_GENERATION` | `true` | **测试代码生成** - 自动生成单元测试和集成测试 |
| `CURSOR_ERROR_ANALYSIS` | `true` | **错误分析能力** - 深度分析错误原因和解决方案 |

#### 文件操作能力
| 配置项 | 默认值 | 说明 | 安全级别 |
|--------|--------|------|----------|
| `CURSOR_FILE_READING` | `true` | **文件读取权限** - 允许AI读取项目文件内容 | 🟢 低风险 |
| `CURSOR_FILE_WRITING` | `false` | **文件写入权限** - 允许AI创建和修改文件 | 🟡 谨慎开启 |
| `CURSOR_FILE_SEARCH` | `true` | **文件搜索功能** - 在项目中搜索特定文件和内容 | 🟢 低风险 |
| `CURSOR_FILESYSTEM_ACCESS` | `false` | **文件系统访问** - 更广泛的文件系统操作权限 | 🔴 谨慎开启 |

#### 项目分析能力
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_PROJECT_ANALYSIS` | `true` | **项目结构分析** - 分析项目的整体架构和组织结构 |
| `CURSOR_DEPENDENCY_ANALYSIS` | `true` | **依赖关系分析** - 分析项目的依赖关系和模块间的交互 |
| `CURSOR_ARCHITECTURE_ANALYSIS` | `true` | **架构分析** - 深度分析软件架构和设计模式 |
| `CURSOR_PERFORMANCE_OPTIMIZATION` | `true` | **性能优化建议** - 提供代码和架构的性能优化建议 |
| `CURSOR_SECURITY_ANALYSIS` | `true` | **安全分析功能** - 检查代码中的安全漏洞和风险 |

### 📝 文档和注释功能

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_DOCUMENTATION_GENERATION` | `true` | **文档自动生成** - 根据代码自动生成技术文档 |
| `CURSOR_COMMENT_GENERATION` | `true` | **代码注释生成** - 为代码添加详细的注释说明 |

### 🧠 思考配置选项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_DEPTH_LEVEL` | `5` | **思考深度级别** - 问题分析的深度 (1-10) |
| `CURSOR_SHOW_THINKING` | `true` | **显示思考过程** - 是否在响应中显示AI的思考步骤 |
| `CURSOR_STEP_BY_STEP` | `true` | **逐步分析模式** - 将复杂问题分解为步骤处理 |
| `CURSOR_REASONING_CHAINS` | `true` | **推理链展示** - 显示逻辑推理的完整链条 |
| `CURSOR_SELF_VERIFICATION` | `true` | **自我验证机制** - AI对自己的答案进行验证和检查 |
| `CURSOR_ALTERNATIVE_APPROACHES` | `true` | **提供替代方案** - 为问题提供多种解决方案 |

### 📚 上下文配置选项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_MAX_CONTEXT_TOKENS` | `8192` | **最大上下文Token数** - 对话中保持的最大上下文长度 |
| `CURSOR_MAX_FILES` | `50` | **最大处理文件数** - 单次可以分析的最大文件数量 |
| `CURSOR_MAX_FILE_SIZE` | `1048576` | **单个文件大小限制** - 每个文件的最大大小(字节，默认1MB) |
| `CURSOR_CONVERSATION_HISTORY` | `10` | **对话历史长度** - 保持的对话轮数 |
| `CURSOR_INCLUDE_EDIT_HISTORY` | `true` | **包含编辑历史** - 是否在上下文中包含文件编辑历史 |
| `CURSOR_INCLUDE_PROJECT_STRUCTURE` | `true` | **包含项目结构信息** - 是否在上下文中包含完整项目结构 |
| `CURSOR_INCLUDE_DEPENDENCIES` | `true` | **包含依赖关系信息** - 是否在上下文中包含依赖关系图 |
| `CURSOR_LARGE_CONTEXT` | `1` | **启用大上下文处理** - 处理超长文本和复杂项目 |

### 🔧 外部工具配置

| 配置项 | 默认值 | 说明 | 安全级别 |
|--------|--------|------|----------|
| `CURSOR_WEB_SEARCH_ENABLED` | `false` | **Web搜索功能** - 允许AI进行网络搜索获取最新信息 | 🟡 中等风险 |
| `CURSOR_CODE_EXECUTION_ENABLED` | `false` | **代码执行权限** - 允许AI执行代码进行测试 | 🔴 高风险功能 |
| `CURSOR_EXTERNAL_API_CALLS` | `false` | **外部API调用** - 允许调用第三方API服务 | 🟡 中等风险 |
| `CURSOR_DATABASE_ACCESS` | `false` | **数据库访问权限** - 允许访问数据库 | 🔴 高风险功能 |
| `CURSOR_WIKI_TOOL` | `[]` | **Wiki工具集成** - 集成Wiki知识库查询 | 🟢 低风险 |
| `CURSOR_WEB_TOOL` | `0` | **Web工具集成** - Web相关工具的启用状态 | 🟢 低风险 |

### ⚙️ 高级控制选项

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_ENABLE_MAX_FEATURES` | `1` | **启用所有最大功能** - 开启所有高级功能 (可能影响性能) |
| `CURSOR_STREAM_CONTROL_FLAG` | `1` | **流式输出控制** - 精细控制流式输出行为 |
| `CURSOR_TOKEN_START_FLAG` | `1` | **Token开始标志** - 控制Token处理的开始时机 |
| `CURSOR_TOKEN_CONTROL_FLAG` | `1` | **Token控制标志** - 高级Token管理选项 |
| `CURSOR_SESSION_TRACKING_FLAG` | `1` | **会话跟踪** - 跟踪用户会话状态和历史 |

### 🎛️ 请求控制标志

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_CONTROL_FLAG` | `true` | **主控制标志** - 全局功能开关 |
| `CURSOR_INSTRUCTION_FLAG` | `1` | **指令处理标志** - 如何处理用户指令 |
| `CURSOR_MODEL_FLAG` | `1` | **模型选择标志** - 动态模型选择控制 |
| `CURSOR_REQUEST_FLAG` | `1` | **请求类型标志** - 请求处理方式控制 |
| `CURSOR_FEEDBACK_FLAG` | `1` | **反馈收集标志** - 是否收集用户反馈数据 |
| `CURSOR_DESIRED_MAX_TOKENS` | `2048` | **期望最大Token数** - 响应的期望最大长度 |
| `CURSOR_CONTENT_FORMAT` | `markdown` | **内容格式** - 响应内容的格式类型 |

### 🌐 系统环境配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `CURSOR_TIMEZONE` | `Asia/Shanghai` | **客户端时区设置** |
| `CURSOR_CLIENT_VERSION` | `0.50.5` | **客户端版本号** |
| `CURSOR_CONFIG_VERSION` | `v1.0.0` | **配置版本号** - 配置文件的版本标识 |
| `CURSOR_PROJECT_TYPE` | `javascript` | **项目类型标识** - 帮助AI理解项目性质 |

## 🎯 预设配置模式

### ASK模式 (简单问答)
```env
CURSOR_MAX_MODE_ENABLED=false
CURSOR_AGENT_MODE=false
CURSOR_THINKING_MODE=false
CURSOR_CODE_GENERATION=true
CURSOR_FILE_READING=true
CURSOR_FILE_WRITING=false
CURSOR_SHOW_THINKING=false
```

### AGENT模式 (智能代理)
```env
CURSOR_MAX_MODE_ENABLED=true
CURSOR_AGENT_MODE=true
CURSOR_THINKING_MODE=true
CURSOR_THINKING_DEPTH=5
CURSOR_PROJECT_ANALYSIS=true
CURSOR_FILE_WRITING=true
CURSOR_CODE_REFACTORING=true
CURSOR_SHOW_THINKING=true
```

### MAX模式 (全功能)
```env
CURSOR_MAX_MODE_ENABLED=true
CURSOR_AGENT_MODE=true
CURSOR_ENABLE_MAX_FEATURES=1
CURSOR_THINKING_DEPTH=10
CURSOR_LARGE_CONTEXT=1
CURSOR_SHOW_THINKING=true
# 启用所有Agent能力...
```

## ⚠️ 安全建议

### 🔴 高风险功能 (谨慎开启)
- `CURSOR_CODE_EXECUTION_ENABLED`: 允许执行代码
- `CURSOR_DATABASE_ACCESS`: 数据库访问权限
- `CURSOR_FILESYSTEM_ACCESS`: 文件系统全面访问

### 🟡 中等风险功能 (建议监控)
- `CURSOR_FILE_WRITING`: 文件写入权限
- `CURSOR_WEB_SEARCH_ENABLED`: 网络搜索功能
- `CURSOR_EXTERNAL_API_CALLS`: 外部API调用

### 🟢 低风险功能 (安全开启)
- `CURSOR_FILE_READING`: 文件读取
- `CURSOR_CODE_UNDERSTANDING`: 代码理解
- `CURSOR_DOCUMENTATION_GENERATION`: 文档生成

## 🔄 配置热重载

修改配置文件后，可以通过以下方式重新加载：

1. **重启服务** (推荐):
```bash
npm start
```

2. **API重载** (如果支持):
```bash
curl -X POST http://localhost:3010/v1/admin/reload-config
```

## 🐛 常见问题

### Q: 配置修改后没有生效？
A: 确保：
1. 配置文件名为 `cursor-config.env`
2. 重启了服务
3. 环境变量格式正确（boolean用true/false，数字不加引号）

### Q: MAX模式无法启用？
A: 检查以下配置：
1. `CURSOR_MAX_MODE_ENABLED=true`
2. `CURSOR_AGENT_MODE=true` 
3. 模型名称包含"max"关键词

### Q: 思考过程不显示？
A: 确保：
1. `CURSOR_THINKING_MODE=true`
2. `CURSOR_SHOW_THINKING=true`
3. `CURSOR_THINKING_DEPTH > 0`

## 📚 相关文档

- [项目README](README.md)
- [安装指南](SETUP.md)
- [API文档](API.md)
- [故障排除](TROUBLESHOOTING.md) 