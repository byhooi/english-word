window.WORD_UNITS = [
  { id: "u1", label: "Unit 1", theme: "周末生活", words: [
    ["go jogging","去慢跑"],["go fishing","去钓鱼"],["do chores","做家务"],["watch TV","看电视"],["play with friends","和朋友一起玩"],["have a picnic","野餐"],["busy","忙碌的",1],["weekend","周末"],["plan","计划"],["early","早的",1],["catch","抓住",1],["any","任何",1],["robot","机器人",1],["sock","袜子",1],["sweep","打扫；清扫",1],["warm up","热身"],["more ... than","超过；比……更……"]
  ]},
  { id: "u2", label: "Unit 2", theme: "健康习惯", words: [
    ["do exercise","做运动"],["eat healthy food","吃健康的食物"],["drink a lot of water","多喝水"],["get enough sleep","保证充足的睡眠"],["strong","强壮的",1],["poster","海报"],["about","关于",1],["habit","习惯"],["junk food","垃圾食品"],["must","必须",1],["less","更少的"],["hard","难的",1],["try","尝试",1],["lie","躺"],["ill","生病的",1],["a glass of","一杯"],["Me too.","我也是。"]
  ]},
  { id: "u3", label: "Unit 3", theme: "方向与旅行", words: [
    ["north","北方"],["south","南方"],["east","东方"],["west","西方"],["capital","首都"],["museum","博物馆"],["palace","王宫；宫殿"],["tourist","游客"],["visit","参观；拜访",1],["northwest","西北"],["across","穿过"],["fish and chips","炸鱼薯条"],["popular","流行的；受欢迎的"],["wine","葡萄酒"],["on foot","步行"]
  ]},
  { id: "u4", label: "Unit 4", theme: "假期旅行", words: [
    ["mountain","山"],["cave","洞穴"],["waterfall","瀑布"],["hotel","酒店"],["holiday","假期",1],["will","将；将要",1],["soon","很快；马上"],["shall","（表示将来的可能性）将"],["high-speed train","高铁"],["explore","探索"],["pagoda","塔"],["stay","待；暂住"],["cave house","窑洞"],["famous","著名的",1],["deep-fried cake","油炸糕"],["wonderful","令人惊奇的；令人赞叹的",1],["view","景色；风景"],["It sounds great.","听起来很棒。"],["I can't wait to go!","我等不及要去了！"]
  ]},
  { id: "u5", label: "Unit 5", theme: "生命与成长", words: [
    ["get sunlight","获取阳光"],["get food and water","获取食物和水"],["grow","生长"],["change","变化"],["move","移动",1],["living","有生命的"],["nonliving","无生命的"],["thing","东西"],["air","空气",1],["by themselves","独自地；无需外力地"],["important","重要的"],["by itself","独自地；无需外力地"],["look around","环顾"]
  ]},
  { id: "u6", label: "Unit 6", theme: "保护环境", words: [
    ["smoke","烟"],["dirty","脏的",1],["rubbish","垃圾"],["recycle","回收利用"],["reduce","减少"],["natural resources","自然资源"],["call","把……叫做",1],["wood","木材"],["land","土地"],["why","为什么",1],["clean","干净的",1],["hurt","伤害",1],["factory","工厂"],["near","在……附近",1],["those","那些",1],["turn off","关掉"]
  ]},
  { id: "u7", label: "Unit 7", theme: "节日与家人", words: [
    ["aunt","阿姨；姑母；姨母；伯母；婶母",1],["uncle","舅父；叔父；伯父；姑父；姨父",1],["together","一起"],["celebrate","庆祝"],["main","主要的"],["eve","前夕"],["stocking","长筒袜"],["visit relatives","拜访亲戚；探亲"],["eat mooncakes","吃月饼"],["have a dragon boat race","进行龙舟比赛"],["watch lanterns","赏花灯"],["next month","下个月"],["make jiaozi","包饺子"],["watch a lion dance","观看舞狮表演"],["have a big meal","吃大餐"],["put up","搭建；张贴；挂起"]
  ]},
  { id: "u8", label: "Unit 8", theme: "感受与想象", words: [
    ["fast","快的",1],["slow","慢的",1],["excited","兴奋的",1],["unhappy","不开心的"],["feel","觉得；感到",1],["feeling","感情；情绪"],["relaxed","放松的"],["person","人"],["imagination","想象；想象力"],["imagine","想象"],["all over the world","世界各地"]
  ]},
  { id: "proper", label: "专有名词", theme: "世界旅行", words: [
    ["China","中国"],["France","法国"],["UK","英国"],["Paris","巴黎"],["the Eiffel Tower","埃菲尔铁塔"],["Big Ben","大本钟"],["Venice","威尼斯"],["Italy","意大利"],["Suzhou","苏州"],["Asia","亚洲"],["the Great Wall","长城"],["Beijing roast duck","北京烤鸭"],["Europe","欧洲"],["London","伦敦"],["Tower Bridge","伦敦塔桥"],["the British Museum","大英博物馆"],["the Louvre Museum","卢浮宫"],["India","印度"],["Japan","日本"],["Canada","加拿大"],["North America","北美洲"],["Harbin","哈尔滨"],["the Ice and Snow World","冰雪大世界"],["the Northeast Tiger Forest Park","东北虎林园"],["Mount Lushan","庐山"],["the Milky Way","银河"],["Yan'an","延安"],["Yan'an Revolutionary Memorial Hall","延安革命纪念馆"],["Pagoda Hill","宝塔山"],["the Hukou Waterfall","壶口瀑布"],["Shaanxi Province","陕西省"],["the Yellow River","黄河"],["the Palace Museum","故宫博物院"],["Sanya","三亚"],["Spring Festival","春节"],["Lantern Festival","元宵节"],["Dragon Boat Festival","端午节"],["Mid-Autumn Festival","中秋节"],["Christmas","圣诞节"]
  ]}
].map(unit => ({...unit, words: unit.words.map((w, index) => ({ id: `${unit.id}-${index}`, en: w[0], zh: w[1], star: Boolean(w[2]) }))}));
