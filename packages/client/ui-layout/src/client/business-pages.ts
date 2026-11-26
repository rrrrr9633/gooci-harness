/** Business pages are independent of the selected Session and registered global panels. */
export const MODULES = [
  { id: 'AI_HUB', label: 'AI中台', glyph: '台', purpose: '围绕现场问题，选择问答、检索、流程执行或安全分析。' },
  { id: 'APP_EQKB', label: 'AI设备知识库', glyph: '知', purpose: '按设备型号查找操作规程、保养要求与常见故障的处理依据。', pending: '设备台账、型号对应的说明书及维修案例。' },
  { id: 'APP_SAFETY', label: '安全生产AI行为监控', glyph: '安', purpose: '复核现场行为告警，确认违规位置、责任区域与处置进展。', pending: '监控点位、告警片段及整改回执。' },
  { id: 'APP_RDKB', label: '知识库研发辅助', glyph: '研', purpose: '在设计评审中查阅技术规范、历史方案和试验结论。', pending: '研发文档版本、设计变更记录及试验报告。' },
  { id: 'APP_APS', label: 'AI排程预测', glyph: '排', purpose: '比较订单交期与可用产能，定位可能延误的工序。', pending: '生产订单、工艺路线、班次和设备产能。' },
  { id: 'APP_VOUCHER', label: 'AI凭证自动处理', glyph: '证', purpose: '核对原始单据与记账科目，将待复核的凭证交给财务人员。', pending: '原始票据、会计科目映射及凭证审核记录。' },
  { id: 'APP_RECON', label: 'AI自动对账', glyph: '账', purpose: '匹配收付款流水与账簿，找出金额、日期或交易对手不符的记录。', pending: '银行流水、往来明细及差异确认结果。' },
] as const

export const HUB_TABS = [
  { id: 'qa', label: '设备问答', purpose: '从设备型号和故障现象出发，查找有手册依据的排查步骤。', pending: '设备档案、故障问答服务及手册引用。' },
  { id: 'search', label: '知识检索', purpose: '按关键字或工艺主题定位文档，核对来源和适用版本。', pending: '知识索引、文档权限及原文链接。' },
  { id: 'flow', label: '流程执行', purpose: '选择作业流程，核对执行条件并跟踪每一步的结果。', pending: '流程模板、审批节点及执行回执。' },
  { id: 'safety', label: '安全分析', purpose: '汇总班组与区域的隐患，比较风险趋势和整改成效。', pending: '巡检记录、风险分级标准及整改台账。' },
] as const

export type BusinessModule = typeof MODULES[number]
export type HubTab = typeof HUB_TABS[number]

/** Standalone mode omits permissions; managed mode supplies an explicit allowlist. */
export function visibleBusinessModules(allowedModuleIds?: readonly string[]) {
  return allowedModuleIds === undefined ? MODULES : MODULES.filter(item => allowedModuleIds.includes(item.id))
}

/** An absent or unknown module opens the hub; only the hub consumes tab. */
export function readBusinessPage() {
  const query = new URLSearchParams(window.location.search)
  const module = MODULES.find(item => item.id === query.get('fn')) ?? MODULES[0]
  const tab = module.id === 'AI_HUB' && HUB_TABS.find(item => item.id === query.get('tab')) || HUB_TABS[0]
  return { module, tab }
}
