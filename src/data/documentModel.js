// Single source of truth for the document content.
// Used by both the UI (MockSplitView) and the AI Simulator.

export const DOCUMENT_CONTENT = [
    {
        id: "block-doc-title",
        label: "Title",
        text: "关于 AI 企业积分对白名单客户收费调整的公告"
    },
    {
        id: "block-doc-intro-1",
        label: "Intro Greeting",
        text: "尊敬的 MasterGo AI 用户，您好！"
    },
    {
        id: "block-doc-intro-2",
        label: "Intro Main",
        text: "非常感谢您一直以来对我们服务的信任与支持。随着 AI 技术的不断提升，为了持续为您提供更优质、稳定且富有创新性的 AI 快搭和 AI 设计助手应用服务，我们将对 AI 企业积分收费策略由免费试用正式进入付费商用。"
    },
    {
        id: "block-section-1-text",
        label: "Section 1 Reason",
        text: "为了进一步加大在 AI 快搭和 AI 设计助手技术研发上的投入，提升输出物的准确性、优化模型的性能，确保您能获得行业领先的 AI 服务体验。经过全面评估与慎重考虑，我们决定对白名单客户的 AI 企业积分收费进行调整。"
    },
    {
        id: "block-section-2-intro",
        label: "Section 2 Intro",
        text: "自 2026 年 2 月 26 日起，AI 企业积分将正式从免费试用模式转变为基于应用场景的收费模式，具体收费规则如下："
    },
    // Skipping static tables for now as they are harder to highlight partially in this simple model, 
    // but including specific highlightable values inside them.
    {
        id: "block-rule-perf-val",
        label: "Performance Rule Value",
        text: "0分/次 | 0分/次"
    },
    {
        id: "block-section-3-item-1",
        label: "Buffer Period",
        text: "在 2026 年 1 月 26 日至 2026 年 2 月 25 日期间，您仍可免费使用 AI 快搭和 AI 设计助手。"
    },
    {
        id: "block-section-3-item-2",
        label: "History Protection",
        text: "对于在调整生效前已购买且尚未使用完的 AI 积分，不影响您的正常使用。"
    },
    {
        id: "block-section-4-text",
        label: "How to Buy",
        text: "若您希望持续使用 AI 快搭和 AI 设计助手产品，可购买 AI 企业积分套餐。具体信息，您可以联系客户经理，获取专属折扣优惠。"
    }
];

export const getDocText = (id) => {
    const item = DOCUMENT_CONTENT.find(d => d.id === id);
    return item ? item.text : "";
};
