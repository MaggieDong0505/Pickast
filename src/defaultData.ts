/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BriefingCardData } from './types';

export const initialData: BriefingCardData = {
  dateStr: '2026.06.11',
  chinaDateStr: '丙戌年五月廿七 / THURSDAY',
  title: '今天最值得听 • TODAY\'S VOICE',
  issueNo: '第 142 期',
  mainEpisode: {
    podcastName: '乱翻书',
    episodeTitle: '140. 对姚顺宇的4小时访谈：AGI 的一线思考与信仰落地',
    coverText: '乱翻书',
    coverBg: 'bg-[#18181B]',
    coverTextColor: 'text-amber-50',
    guestName: '姚顺宇',
    guestBackground: '前 Anthropic、现 Google DeepMind 研究员',
    whyRecommended: '极其难得的行业一线视角与 AGI 时代的底层思考，长达四小时却含金量极高，字字珠玑，金句频出。',
    viewpoints: [
      'AI 个人英雄主义时代已终结，未来的主流是组织化的集体计算与工程融合。',
      'Coding 是 AI 最原生的场景，不是在老软件上打补丁，而是完全用 AI 重塑代码生成。',
      '大语言模型不是数据库，它本质上是一个高度压缩的、通用的符号推理引擎。',
      'Scaling Law 依然强大有效，但是如何通过精细的工程落地抹平现实差距是关键。',
      '下一代 AI 应用的绝对爆发点，藏在企业复杂工作流的全面拆解、定制与重构中。',
      '未来所有人都是「冲浪者」，唯有真正贴近应用波澜的人才不会被浪潮打翻。'
    ],
    goldenQuotes: [
      {
        quote: '现在大家都是冲浪的人，本质上是那个浪，而不是冲浪的人。',
        source: '姚顺宇 / 《乱翻书》 Ep.140'
      }
    ],
    triageTag: '🎧值得细听',
    href: 'https://www.example.com/podcast/luanfanshu/140'
  },
  backupEpisodes: [
    {
      podcastName: '忽左忽右',
      episodeTitle: '293. 独立书店的生存与理想：在纸张消逝的时代，我们谈论些什么',
      coverText: '忽左',
      coverBg: 'bg-[#2A2B2D]',
      coverTextColor: 'text-[#EFECE5]',
      guestBackground: '程衍樑 × 著名独立书店主理人',
      whyRecommended: '极其难得的实体空间与纸质信仰的深度对谈，在媒介碎裂的时代长达两小时却字字透彻，思想深刻，金句频出。',
      goldenQuotes: [
        {
          quote: '书店不是为了卖书而存在，它是一个物理实体，让思想在水泥森林中呼吸。',
          source: '程衍樑 / 《忽左忽右》 Ep.293'
        }
      ],
      scenario: '想轻松点挂着听',
      triageTag: '🚶边走边听',
      href: 'https://www.example.com/podcast/huzuohuyou/293'
    },
    {
      podcastName: '知行小酒馆',
      episodeTitle: '102. 个人财务健康的急救指南：通胀环境下的防御性财富规划',
      coverText: '知行',
      coverBg: 'bg-[#3E423A]',
      coverTextColor: 'text-[#F3F0E7]',
      guestBackground: '雨白 × 资深宏观资产配置规划专家',
      whyRecommended: '极其难得的个人财富防护与周期性防御指南，在通胀阴霾下长达近两小时却干货满满，条理分明，解答彻底。',
      goldenQuotes: [
        {
          quote: '财富规划本质上不是为了暴富，而是为了在不确定的浪潮中，保证我们的生活不被打翻。',
          source: '雨白 / 《知行小酒馆》 Ep.102'
        }
      ],
      scenario: '只有10分钟限制时',
      triageTag: '⏭️可跳过',
      href: 'https://www.example.com/podcast/zhixing/102'
    }
  ],
  synthesis: {
    consensus: [
      'AI 正在快速重塑日常知识生产与白领工作流，掌握自动化 Agent 协同早已不再是未来，而是当下的基本生产力。',
      '高品质播客内容的核心壁垒，在于跨越圈层的一线信息密度、更长周期下的追问、以及在嘈杂社交媒介中难得的真诚。'
    ],
    divergence: [
      '关于通用人工智能 (AGI) 奇点降临的时间段：顶级实验室的研究员持极度乐观且紧迫的预判，而具体商业落地侧与实体巨头持更严谨、分步推进的温和观望态度。',
      '个人在 AI 协同时代的生存模型：究竟是作为「单兵作战」的独立数字游民最大化效率，还是作为核心组件并入由大厂主导的大规模智能协同网络？'
    ]
  }
};
