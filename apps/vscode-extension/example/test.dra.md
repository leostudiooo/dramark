---
meta:
  title: 在公园的长椅上睡大觉
  author: 小橘猫_zzz
  locale: zh-CN
translation:
  source_lang: zh-CN
  target_lang: en
casting:
  characters:
    - name: 小帕
      aliases: [帕]
      mic: B1
    - name: 小塔
      aliases: [塔]
      mic: B2
    - name: 小柴
      aliases: [柴]
      mic: B3
    - name: 小夜
      aliases: [夜, 夜游神]
      mic: B4
tech:
  mics:
    - id: B1
    - id: B2
    - id: B3
    - id: B4
  sfx:
    color: "#66ccff"
    entries:
      - id: BGM_ENTER
        desc: 入场音乐
      - id: BGM_PARK_NIGHT
        desc: 夜晚公园主题
      - id: SFX_THUD
        desc: 手刀敲击声
  lx:
    color: "#ff66cc"
    entries:
      - id: SPOT_PARK
        desc: 公园环境光
      - id: SPOT_XIAOTA
        desc: 小塔独光
      - id: SPOT_DUO
        desc: 双人光区
  efx:
    color: "#ccff66"
    entries: 
      - id: "1234"
        desc: "1234"
---

# 02 相遇小帕

<<BGM_ENTER GO>> <<LX: SPOT_PARK 渐起>>

众人四下，小塔到长椅上躺着。小幽把椅子挪到上场区前。
% 独光 小帕往上场区前方椅子走，后续搬到长椅处。

$$ 小帕饿饿歌
@小帕
= 哪里会有夜宵呢
Where to find a bite tonight?
= 哪里有好吃的呢
Where's the tasty in my sight?
= 到了夜里总是会突然肚子饿
It always happens in the midnight -- the hunger strikes
= 便利店已经关门
The stores are closed, I tried the door
= 公园里也没有人
The park is empty, searched the floor
!!
@小帕
= 我该去哪里找好吃的夜宵呢
How can I find my late night bite that I long for?
!!
---
小帕发现了躺着的小塔。

@小帕 [惊喜地]
人类 人类
竟然是没见过的人类
让我猜猜 你从哪来
又为何会 在这熟睡
何如 何如
我已经饿得坚持不住
要不趁他 还没醒来
吃饱喝足 然后跑路
虽说可以等天明
但眼前就有一名
还飘过来一阵垂涎欲滴的香气
就算出了什么问题
也不会是啥大问题
毕竟现在肚子饿才是当务之急

{蹲下，捧起小塔的手｜小塔醒来}

那我 还在 忍耐什么
吃饱再说

{小塔醒来起身，刚好小帕一口咬去。}

@小塔
什么情况
谁告诉我 这是 什么情况
难道是睡得太久
有些迷糊
我大概在做梦
感觉──嘶{（小帕松口）}
有点痛 究竟──
$$

@小帕
真好喝！
@@

小塔往左挪一个位置。<<BGM_ENTER STOP>>

@小帕
晚上好呀夜宵先生。

@小塔
晚上好？夜宵？<<BGM_ENTER STOP>>

@小帕
咳哼，我是伟大的吸血鬼公主小帕，你等食材速速报上名来！

@小塔
哈？

%%
这是一个块注释测试
在多行上
%%

@小帕
嗯？

@@
小塔行礼。<<BGM_PARK_NIGHT GO>>

@小塔
参见公主殿下，我叫小塔。

@小帕
很好很好。小塔哦，我赐予你"八珍玉食"的称谓！庆贺吧，pia叽pia叽pia叽pia叽。

@小塔
谢殿下！那小的先行告退？

@小帕
别急！再多聊聊嘛，我从来没见过你，怎么进来的？<<BGM_PARK_NIGHT GO>>

@@
<<LX: SPOT_XIAOTA>>

$$
@小塔
这怎么聊
不如问我 为何 这还不跑
又不是和陌生人
甚至不是人
好想立刻醒来
但是现在
% test comment 1

@@
<<<
LX: SPOT_DUO 灯光变化同时打亮二人。
>>>

@小塔 @小帕
看着她 粉白色的脸｜$夜宵先生$
她 清澈的双眼｜$你为什么不说话$
我 无法移开视线｜$你从哪里来的呀$

@@
小帕搬起椅子到小塔另一侧。

@小塔 @小帕
回想她 轻灵的动作｜你为什么不说话
她 俏皮地诉说｜你从哪里来的呀
我饿了 饿了 饿了｜嘟嘟 小塔 咘咘
然后 我就被咬了｜{打断} $搭理我一下！$
$$

@@
<<SFX: SFX_THUD>> 小帕手刀敲小塔，小塔被吓一跳。

@小塔
啊我在。

@小帕[哼]
{起身}
作为提供 夜宵的回赠
我可以满足 你一个愿望
说吧，你想要什么？

......想这么久！

@小塔
啊------决定了，我要黄金万两！

@小帕
做不到噢。<<BGM_PARK_NIGHT GO>>

@小塔
那，长生不老！ % comment

@小帕
做不到噢。

@小塔
把我也变成吸血鬼？

@小帕
做不到噢。

@小塔
你能做到什么啦！

@小帕
嗯......这是个好问题。

@小塔
......那我问个问题吧。这是哪里？<<BGM_PARK_NIGHT GO>>

@小帕
这是公园呀。

@小塔
这不是我认识的公园，到底是哪里？

@小帕
噢~这是梦里！

@@
小塔在现实醒来。小柴在观众席用手电筒照小塔。

@小柴
醒醒，闭园咯！快回家去。

@小塔
她呢？

@小柴
谁啊，这不就你一个？赶紧走。

@@
小塔疑惑下。

@小柴
这破公园咋还有人来......

@@
小柴下。<<BGM_PARK_NIGHT GO>>

$$
@小帕
还想着多聊几句
突然不知到哪去
虽说意外的邂逅感觉很有趣
但现在仔细想来
难道意味快要迎来......
见面短短而思绪满满 难以忘怀
我们是否还会相遇
$$

@@
小帕下。

<<< SFX 春去秋来 >>>