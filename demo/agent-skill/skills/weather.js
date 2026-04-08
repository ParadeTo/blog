// 天气查询脚本
// 用法：node weather.js 北京

const city = process.argv[2]

const mockData = {
  '北京': { temp: 22, condition: '晴', humidity: 45, wind: '北风3级' },
  '上海': { temp: 25, condition: '多云', humidity: 62, wind: '东南风2级' },
  '深圳': { temp: 28, condition: '阵雨', humidity: 78, wind: '南风4级' },
  '广州': { temp: 27, condition: '雷阵雨', humidity: 82, wind: '南风3级' },
}

if (city && mockData[city]) {
  console.log(JSON.stringify({ city, ...mockData[city] }))
} else {
  console.log(JSON.stringify({
    error: '未找到该城市',
    supported: Object.keys(mockData),
  }))
}
