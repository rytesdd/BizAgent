/**
 * 文件解析服务
 * 
 * 支持解析：
 * - TXT 文本文件
 * - MD Markdown 文件
 * - PDF 文档（需要 pdf-parse 依赖）
 */

const fs = require("fs");
const path = require("path");

// 尝试加载 pdf-parse，如果没安装则降级处理
let pdfParse = null;
try {
  pdfParse = require("pdf-parse");
} catch (e) {
  console.log("[FileParser] pdf-parse 未安装，PDF 解析功能不可用");
}

// ============================================
// 日志工具
// ============================================

function logStep(message, meta) {
  const timestamp = new Date().toISOString();
  if (meta) {
    console.log(`[${timestamp}] [FileParser] ${message}`, meta);
    return;
  }
  console.log(`[${timestamp}] [FileParser] ${message}`);
}

// ============================================
// 文件类型检测
// ============================================

const SUPPORTED_TYPES = {
  TXT: [".txt"],
  MD: [".md", ".markdown"],
  PDF: [".pdf"],
};

function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (SUPPORTED_TYPES.TXT.includes(ext)) return "TXT";
  if (SUPPORTED_TYPES.MD.includes(ext)) return "MD";
  if (SUPPORTED_TYPES.PDF.includes(ext)) return "PDF";

  return "UNKNOWN";
}

function isSupportedFile(filePath) {
  return getFileType(filePath) !== "UNKNOWN";
}

// ============================================
// 文件解析
// ============================================

/**
 * 解析文件内容
 * @param {string} filePath - 文件路径（multer 保存的路径可能无扩展名）
 * @param {string} [originalFileName] - 原始文件名，用于类型检测（上传时务必传入，否则 PDF 等会判为 UNKNOWN）
 * @returns {Promise<{success: boolean, content?: string, error?: string, type?: string}>}
 */
async function parseFile(filePath, originalFileName) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: "文件不存在" };
  }

  const fileType = (originalFileName && getFileType(originalFileName) !== "UNKNOWN")
    ? getFileType(originalFileName)
    : getFileType(filePath);
  logStep(`开始解析文件`, { filePath, fileType, originalFileName });

  try {
    switch (fileType) {
      case "TXT":
      case "MD":
        return await parseTextFile(filePath, fileType);

      case "PDF":
        return await parsePdfFile(filePath);

      default:
        return { success: false, error: `不支持的文件类型: ${originalFileName ? path.extname(originalFileName) || originalFileName : path.extname(filePath)}` };
    }
  } catch (error) {
    logStep(`解析失败`, { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * 解析文本文件
 */
async function parseTextFile(filePath, type) {
  const content = fs.readFileSync(filePath, "utf8");
  logStep(`文本文件解析成功`, { length: content.length });

  return {
    success: true,
    content,
    type,
    metadata: {
      lines: content.split("\n").length,
      characters: content.length,
    },
  };
}

/**
 * 解析 PDF 文件
 */
async function parsePdfFile(filePath) {
  if (!pdfParse) {
    return {
      success: false,
      error: "PDF 解析功能未启用。请运行: npm install pdf-parse",
    };
  }

  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  logStep(`PDF 解析成功`, {
    pages: data.numpages,
    length: data.text.length,
  });

  return {
    success: true,
    content: data.text,
    type: "PDF",
    metadata: {
      pages: data.numpages,
      characters: data.text.length,
      info: data.info,
    },
  };
}

/**
 * 从 Buffer 解析文件
 * @param {Buffer} buffer - 文件内容
 * @param {string} originalName - 原始文件名
 */
async function parseBuffer(buffer, originalName) {
  const fileType = getFileType(originalName);
  logStep(`从 Buffer 解析文件`, { originalName, fileType });

  try {
    switch (fileType) {
      case "TXT":
      case "MD":
        const content = buffer.toString("utf8");
        return {
          success: true,
          content,
          type: fileType,
          metadata: {
            lines: content.split("\n").length,
            characters: content.length,
          },
        };

      case "PDF":
        if (!pdfParse) {
          return {
            success: false,
            error: "PDF 解析功能未启用。请运行: npm install pdf-parse",
          };
        }
        const data = await pdfParse(buffer);
        return {
          success: true,
          content: data.text,
          type: "PDF",
          metadata: {
            pages: data.numpages,
            characters: data.text.length,
          },
        };

      default:
        return { success: false, error: `不支持的文件类型: ${path.extname(originalName)}` };
    }
  } catch (error) {
    logStep(`Buffer 解析失败`, { error: error.message });
    return { success: false, error: error.message };
  }
}

// ============================================
// 获取支持状态
// ============================================

function getParserStatus() {
  return {
    supported_types: ["TXT", "MD", "PDF"],
    pdf_enabled: !!pdfParse,
    extensions: {
      text: [...SUPPORTED_TYPES.TXT, ...SUPPORTED_TYPES.MD],
      pdf: SUPPORTED_TYPES.PDF,
    },
  };
}

// ============================================
// 导出
// ============================================

module.exports = {
  parseFile,
  parseBuffer,
  getFileType,
  isSupportedFile,
  getParserStatus,
  SUPPORTED_TYPES,
};
