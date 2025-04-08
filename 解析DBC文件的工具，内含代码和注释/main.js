const path = require('path');
const fs = require('fs').promises;

// 清空缓存确保重新加载
delete require.cache[require.resolve('./parser')];
const parser = require('./parser');

async function saveAsJson(messages, outputPath) {
  try {
    const jsonData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        messageCount: messages.length,
        signalCount: messages.reduce((sum, msg) => sum + msg.signals.length, 0)
      },
      messages: messages
    };

    await fs.writeFile(outputPath, JSON.stringify(jsonData, null, 2));
    console.log(`✅ JSON文件已保存到: ${outputPath}`);
  } catch (error) {
    console.error('保存JSON文件失败:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log("✅ 程序启动");

    // 1. 解析文件路径
    const dbcPath = path.resolve('./example.dbc');
    console.log("🔍 解析文件绝对路径:", dbcPath);

    // 2. 设置输出路径
    const outputPath = path.resolve('./dbc_output.json');
    console.log("📁 输出文件路径:", outputPath);

    // 3. 解析DBC文件
    console.log("📄 开始解析DBC文件...");
    const dbcData = await parser.parseDBC(dbcPath);
    console.log("📊 解析结果:", {
      报文数量: dbcData.messages.length,
      信号总数: dbcData.messages.reduce((sum, msg) => sum + msg.signals.length, 0)
    });

    // 4. 保存为JSON文件
    console.log("💾 开始生成JSON文件...");
    await saveAsJson(dbcData.messages, outputPath);
    console.log("🎉 数据处理完成");

  } catch (error) {
    console.error('🔥 发生错误:', error);
  }
}

main();