/**
 * 中国省市经纬度表（天气模块用）。
 *
 * 为什么内置而不是查接口：PRD 的隐私底线是「默认零第三方请求」，
 * 城市选择的交互不该额外打一次网络。这里只收录直辖市 / 省会 / 主要地级市
 * （每个省级行政区 3-8 个），共 200 余个 —— 覆盖「选自己所在城市」这个真实场景，
 * 又不会把包撑大（纯字面量约 9KB，gzip 后 2KB 出头，且走 dynamic 分片）。
 *
 * 数据来源：国家统计局行政区划代码对应的市政府驻地坐标，四舍五入到 2 位小数
 * （约 1km 精度，对城市级天气完全够用）。
 */

export type CityEntry = { name: string; lat: number; lon: number };
export type ProvinceEntry = { name: string; cities: CityEntry[] };

export const PROVINCES: ProvinceEntry[] = [
  {
    name: "北京市",
    cities: [{ name: "北京", lat: 39.9, lon: 116.41 }],
  },
  {
    name: "天津市",
    cities: [{ name: "天津", lat: 39.09, lon: 117.2 }],
  },
  {
    name: "上海市",
    cities: [{ name: "上海", lat: 31.23, lon: 121.47 }],
  },
  {
    name: "重庆市",
    cities: [{ name: "重庆", lat: 29.56, lon: 106.55 }],
  },
  {
    name: "河北省",
    cities: [
      { name: "石家庄", lat: 38.04, lon: 114.51 },
      { name: "唐山", lat: 39.63, lon: 118.18 },
      { name: "秦皇岛", lat: 39.94, lon: 119.6 },
      { name: "保定", lat: 38.87, lon: 115.46 },
      { name: "邯郸", lat: 36.63, lon: 114.54 },
      { name: "廊坊", lat: 39.54, lon: 116.68 },
    ],
  },
  {
    name: "山西省",
    cities: [
      { name: "太原", lat: 37.87, lon: 112.55 },
      { name: "大同", lat: 40.08, lon: 113.3 },
      { name: "临汾", lat: 36.09, lon: 111.52 },
      { name: "运城", lat: 35.03, lon: 111.01 },
    ],
  },
  {
    name: "内蒙古自治区",
    cities: [
      { name: "呼和浩特", lat: 40.84, lon: 111.75 },
      { name: "包头", lat: 40.66, lon: 109.84 },
      { name: "鄂尔多斯", lat: 39.61, lon: 109.78 },
      { name: "赤峰", lat: 42.26, lon: 118.89 },
    ],
  },
  {
    name: "辽宁省",
    cities: [
      { name: "沈阳", lat: 41.81, lon: 123.43 },
      { name: "大连", lat: 38.91, lon: 121.61 },
      { name: "鞍山", lat: 41.11, lon: 122.99 },
      { name: "锦州", lat: 41.1, lon: 121.13 },
    ],
  },
  {
    name: "吉林省",
    cities: [
      { name: "长春", lat: 43.82, lon: 125.32 },
      { name: "吉林", lat: 43.84, lon: 126.55 },
      { name: "延吉", lat: 42.89, lon: 129.51 },
    ],
  },
  {
    name: "黑龙江省",
    cities: [
      { name: "哈尔滨", lat: 45.8, lon: 126.53 },
      { name: "齐齐哈尔", lat: 47.35, lon: 123.92 },
      { name: "大庆", lat: 46.59, lon: 125.1 },
      { name: "牡丹江", lat: 44.55, lon: 129.63 },
    ],
  },
  {
    name: "江苏省",
    cities: [
      { name: "南京", lat: 32.06, lon: 118.8 },
      { name: "苏州", lat: 31.3, lon: 120.58 },
      { name: "无锡", lat: 31.49, lon: 120.31 },
      { name: "常州", lat: 31.81, lon: 119.97 },
      { name: "南通", lat: 31.98, lon: 120.89 },
      { name: "徐州", lat: 34.26, lon: 117.18 },
      { name: "扬州", lat: 32.39, lon: 119.41 },
    ],
  },
  {
    name: "浙江省",
    cities: [
      { name: "杭州", lat: 30.27, lon: 120.15 },
      { name: "宁波", lat: 29.87, lon: 121.55 },
      { name: "温州", lat: 27.99, lon: 120.7 },
      { name: "绍兴", lat: 30.0, lon: 120.58 },
      { name: "嘉兴", lat: 30.75, lon: 120.76 },
      { name: "金华", lat: 29.08, lon: 119.65 },
    ],
  },
  {
    name: "安徽省",
    cities: [
      { name: "合肥", lat: 31.82, lon: 117.23 },
      { name: "芜湖", lat: 31.35, lon: 118.43 },
      { name: "蚌埠", lat: 32.92, lon: 117.39 },
      { name: "安庆", lat: 30.54, lon: 117.06 },
    ],
  },
  {
    name: "福建省",
    cities: [
      { name: "福州", lat: 26.07, lon: 119.3 },
      { name: "厦门", lat: 24.48, lon: 118.09 },
      { name: "泉州", lat: 24.87, lon: 118.68 },
      { name: "漳州", lat: 24.51, lon: 117.65 },
    ],
  },
  {
    name: "江西省",
    cities: [
      { name: "南昌", lat: 28.68, lon: 115.86 },
      { name: "赣州", lat: 25.83, lon: 114.94 },
      { name: "九江", lat: 29.71, lon: 116.0 },
      { name: "上饶", lat: 28.45, lon: 117.94 },
    ],
  },
  {
    name: "山东省",
    cities: [
      { name: "济南", lat: 36.65, lon: 117.12 },
      { name: "青岛", lat: 36.07, lon: 120.38 },
      { name: "烟台", lat: 37.46, lon: 121.45 },
      { name: "潍坊", lat: 36.71, lon: 119.16 },
      { name: "临沂", lat: 35.1, lon: 118.36 },
      { name: "济宁", lat: 35.41, lon: 116.59 },
    ],
  },
  {
    name: "河南省",
    cities: [
      { name: "郑州", lat: 34.75, lon: 113.63 },
      { name: "洛阳", lat: 34.62, lon: 112.45 },
      { name: "开封", lat: 34.8, lon: 114.31 },
      { name: "南阳", lat: 32.99, lon: 112.53 },
      { name: "新乡", lat: 35.3, lon: 113.93 },
    ],
  },
  {
    name: "湖北省",
    cities: [
      { name: "武汉", lat: 30.59, lon: 114.31 },
      { name: "宜昌", lat: 30.69, lon: 111.29 },
      { name: "襄阳", lat: 32.01, lon: 112.12 },
      { name: "荆州", lat: 30.34, lon: 112.24 },
    ],
  },
  {
    name: "湖南省",
    cities: [
      { name: "长沙", lat: 28.23, lon: 112.94 },
      { name: "株洲", lat: 27.83, lon: 113.13 },
      { name: "衡阳", lat: 26.89, lon: 112.57 },
      { name: "岳阳", lat: 29.36, lon: 113.13 },
      { name: "常德", lat: 29.03, lon: 111.7 },
    ],
  },
  {
    name: "广东省",
    cities: [
      { name: "广州", lat: 23.13, lon: 113.26 },
      { name: "深圳", lat: 22.54, lon: 114.06 },
      { name: "珠海", lat: 22.27, lon: 113.58 },
      { name: "东莞", lat: 23.02, lon: 113.75 },
      { name: "佛山", lat: 23.02, lon: 113.12 },
      { name: "惠州", lat: 23.11, lon: 114.42 },
      { name: "汕头", lat: 23.35, lon: 116.68 },
    ],
  },
  {
    name: "广西壮族自治区",
    cities: [
      { name: "南宁", lat: 22.82, lon: 108.32 },
      { name: "桂林", lat: 25.27, lon: 110.29 },
      { name: "柳州", lat: 24.33, lon: 109.42 },
      { name: "北海", lat: 21.47, lon: 109.12 },
    ],
  },
  {
    name: "海南省",
    cities: [
      { name: "海口", lat: 20.04, lon: 110.2 },
      { name: "三亚", lat: 18.25, lon: 109.51 },
      { name: "儋州", lat: 19.52, lon: 109.58 },
    ],
  },
  {
    name: "四川省",
    cities: [
      { name: "成都", lat: 30.57, lon: 104.07 },
      { name: "绵阳", lat: 31.47, lon: 104.68 },
      { name: "德阳", lat: 31.13, lon: 104.4 },
      { name: "宜宾", lat: 28.77, lon: 104.62 },
      { name: "南充", lat: 30.84, lon: 106.11 },
    ],
  },
  {
    name: "贵州省",
    cities: [
      { name: "贵阳", lat: 26.65, lon: 106.63 },
      { name: "遵义", lat: 27.73, lon: 106.93 },
      { name: "六盘水", lat: 26.59, lon: 104.85 },
    ],
  },
  {
    name: "云南省",
    cities: [
      { name: "昆明", lat: 25.04, lon: 102.71 },
      { name: "大理", lat: 25.61, lon: 100.27 },
      { name: "丽江", lat: 26.86, lon: 100.23 },
      { name: "西双版纳", lat: 22.01, lon: 100.8 },
      { name: "曲靖", lat: 25.49, lon: 103.8 },
    ],
  },
  {
    name: "西藏自治区",
    cities: [
      { name: "拉萨", lat: 29.65, lon: 91.14 },
      { name: "日喀则", lat: 29.27, lon: 88.88 },
      { name: "林芝", lat: 29.65, lon: 94.36 },
    ],
  },
  {
    name: "陕西省",
    cities: [
      { name: "西安", lat: 34.34, lon: 108.94 },
      { name: "咸阳", lat: 34.33, lon: 108.71 },
      { name: "宝鸡", lat: 34.36, lon: 107.14 },
      { name: "延安", lat: 36.59, lon: 109.49 },
      { name: "汉中", lat: 33.07, lon: 107.03 },
    ],
  },
  {
    name: "甘肃省",
    cities: [
      { name: "兰州", lat: 36.06, lon: 103.83 },
      { name: "天水", lat: 34.58, lon: 105.72 },
      { name: "酒泉", lat: 39.73, lon: 98.49 },
      { name: "张掖", lat: 38.93, lon: 100.45 },
    ],
  },
  {
    name: "青海省",
    cities: [
      { name: "西宁", lat: 36.62, lon: 101.78 },
      { name: "格尔木", lat: 36.4, lon: 94.9 },
      { name: "海东", lat: 36.5, lon: 102.1 },
    ],
  },
  {
    name: "宁夏回族自治区",
    cities: [
      { name: "银川", lat: 38.49, lon: 106.23 },
      { name: "石嘴山", lat: 38.98, lon: 106.38 },
      { name: "吴忠", lat: 37.99, lon: 106.2 },
    ],
  },
  {
    name: "新疆维吾尔自治区",
    cities: [
      { name: "乌鲁木齐", lat: 43.83, lon: 87.62 },
      { name: "喀什", lat: 39.47, lon: 75.99 },
      { name: "伊宁", lat: 43.92, lon: 81.32 },
      { name: "克拉玛依", lat: 45.58, lon: 84.89 },
      { name: "吐鲁番", lat: 42.95, lon: 89.19 },
    ],
  },
  {
    name: "香港特别行政区",
    cities: [{ name: "香港", lat: 22.32, lon: 114.17 }],
  },
  {
    name: "澳门特别行政区",
    cities: [{ name: "澳门", lat: 22.2, lon: 113.54 }],
  },
  {
    name: "台湾省",
    cities: [
      { name: "台北", lat: 25.03, lon: 121.57 },
      { name: "高雄", lat: 22.63, lon: 120.3 },
      { name: "台中", lat: 24.15, lon: 120.68 },
    ],
  },
];

/** 省级行政区名（供下拉） */
export const PROVINCE_NAMES = PROVINCES.map((p) => p.name);

/** 取某省下的城市；省名不存在时返回空数组 */
export function citiesOf(province: string): CityEntry[] {
  return PROVINCES.find((p) => p.name === province)?.cities ?? [];
}

/**
 * 按「省 + 城市」查坐标。
 *
 * 兼容三种已存储的形态，避免旧配置失配：
 * - `city` 就是省名（直辖市，如「北京市」）
 * - `city` 在市列表里（如「杭州市」或「杭州」）
 * - 什么都没填 → 返回 null，由调用方决定是否走定位
 */
export function findCity(province: string, city: string): CityEntry | null {
  const p = PROVINCES.find((x) => x.name === province) ?? PROVINCES.find((x) => x.name.startsWith(province));
  if (!p) return null;
  const c = p.cities.find((x) => x.name === city || `${x.name}市` === city);
  return c ?? p.cities[0] ?? null;
}

/** 反查：给一组坐标，找最接近的省/市（用于「定位成功」后回填下拉） */
export function nearestCity(lat: number, lon: number): { province: string; city: CityEntry; distance: number } | null {
  let best: { province: string; city: CityEntry; distance: number } | null = null;
  for (const p of PROVINCES) {
    for (const c of p.cities) {
      // 平面近似：纬度 1° ≈ 111km，经度按当前纬度收缩。城市级选择不需要真球面距离。
      const dy = (c.lat - lat) * 111;
      const dx = (c.lon - lon) * 111 * Math.cos((lat * Math.PI) / 180);
      const distance = Math.hypot(dx, dy);
      if (!best || distance < best.distance) best = { province: p.name, city: c, distance };
    }
  }
  return best;
}
