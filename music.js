/**
 * @name fashion 
 * @description fashion
 * @version 3.0.0
 */

const { EVENT_NAMES, request, on, send } = globalThis.lx

const WEB_DAV_URL = 'http://2272d280a9.iask.in'

// ====== 获取 WebDAV 文件列表 ====== 
const fetchMusicFiles = () => {
  return new Promise((resolve, reject) => {
    request(WEB_DAV_URL, {
      method: 'GET'
    }, (err, resp) => {
      if (err) return reject(err)
      
      const html = resp.body
      const files = []
      const regex = /href="([^"]+\.(mp3|flac|wav))"/gi
      let match
      
      while ((match = regex.exec(html)) !== null) {
        const filename = decodeURIComponent(match[1].split('/').pop())
        files.push(filename)
      }
      
      resolve(files)
    })
  })
}

// ====== 初始化音乐列表 ====== 
let musicList = []
const initMusicList = async () => {
  try {
    const files = await fetchMusicFiles()
    
    musicList = files.map((filename, index) => {
      let name = filename.replace(/\.(mp3|flac|wav)$/i, '')
      let singer = ''
      
      // 如果文件名是 "歌曲名 - 歌手.mp3"，自动解析
      if (name.includes(' - ')) {
        const parts = name.split(' - ')
        name = parts[0].trim()
        singer = parts[1].trim()
      }
      
      return {
        id: 'id_' + index,
        name,
        singer,
        path: WEB_DAV_URL + encodeURIComponent(filename),
        filename: filename // 添加这个字段，后面要用
      }
    })
    
    console.log('音乐列表初始化完成，共', musicList.length, '首歌曲')

  } catch (e) {
    console.error('初始化音乐列表失败', e)

  }
}


const normalizeText = (str = '') => {
  return str
    .toLowerCase()
    .replace(/\s+/g, '')                 // 去空格
    .replace(/【.*?】/g, '')              // 去 【】
    .replace(/（.*?）/g, '')              // 去 中文（）
    .replace(/\[.*?\]/g, '')              // 去 []
    .replace(/-?(320k|128k|flac|mp3|wav)/gi, '')
    .trim()
}

// ====== 获取实际文件名 ======
const getRealFileName = (musicInfo) => {
  console.log('🔍 分析歌曲信息:', musicInfo)
  
  const name = normalizeText(rawName) //歌曲名称
  const singer = normalizeText(rawSinger) //歌手
  
  // 1.首先检查是否有匹配的歌名加歌手名
  if (name && singer) {
     const found = musicList.find(song => {
      const songName = normalizeText(song.name)
      const songSinger = normalizeText(song.singer)
      return songName === name && songSinger === singer
    })
    if (found) {
      console.log('✅ 命中：歌名 + 歌手')
      return found.filename
    }
  }
  
  // 2. 检查是否有匹配的歌名
  if (name) {
      const found = musicList.find(song => {
      const songName = normalizeText(song.name)
      return songName.includes(name) || name.includes(songName)
    })
    if (found) {
      console.log('✅ 命中：歌名模糊匹配')
      return found.filename
    }
  }
  
  return null
}

// ====== 创建认证头 ======
const createAuthHeaders = () => {
  return {
    'User-Agent': 'LX-Music-Player/2.11.0'
  }
}

// ====== 获取本地实际播放URL ======
const getPlayableUrl = (filename) => {
  return new Promise((resolve) => {
    const encodedFilename = encodeURIComponent(filename)
    const url = WEB_DAV_URL + encodedFilename
    
    console.log(`🔗 原始URL: ${url}`)
    console.log(`📁 文件名: ${filename}`)
    // 使用 request 而不是 globalThis.lx.request
    request(url, {
      method: 'HEAD',
      headers: createAuthHeaders(),
      timeout: 10000
    }, (err, resp) => {
      if (err) {
        console.error('❌ 测试失败:', err.message)
        // 即使失败也返回URL
        resolve(url)
      } else {
        console.log(`✅ 测试成功: ${resp.statusCode}`)
        // 如果是HTML，说明有问题
        if (resp.headers['content-type'] && resp.headers['content-type'].includes('text/html')) {
          console.error('⚠️ 警告：返回的是HTML而不是音频文件！')
        }
        
        // 返回URL
        resolve(url)
      }
    })
  })
}

// ====== 主处理函数 ======
//如果已经有缓存了 再次播放的时候不会在进该方法
on(EVENT_NAMES.request, ({ source, action, info }) => {
  console.log(`\n🎵 ====== 收到请求: ${source}.${action} ======`)
  if (action === 'musicUrl') {
    const musicInfo = info.musicInfo || {}
    console.log('📦 歌曲详情:', JSON.stringify(musicInfo, null, 2))
    
    // 获取正确的文件名
    const filename = getRealFileName(musicInfo)
    console.log(`🎯 确定文件: ${filename}`)
    
    // 返回Promise
    return new Promise((resolve) => {
      getPlayableUrl(filename).then(url => {
        console.log(`🚀 返回播放URL: ${url}`)
        resolve(url)
      }).catch(error => {
        console.error('❌ 获取URL失败:', error)
      })
    })
  }
  
  if (action === 'lyric') {
    return Promise.resolve({ lyric: '', tlyric: '' })
  }
  
  if (action === 'pic') {
    return Promise.resolve('')
  }
  
  return Promise.reject(new Error('不支持的操作'))
})

// ====== 初始化 ======
// 先立即发送初始化事件，然后异步加载音乐列表
console.log('🚀 发送初始化事件...')
send(EVENT_NAMES.inited, {
  openDevTools: false,  //是否开启调试
  sources: {
    wy: { 
      name: '网易云 (WebDAV版)', 
      type: 'music', 
      actions: ['musicUrl'], 
      qualitys: ['128k', '320k'] 
    },
    kg: { 
      name: '酷狗 (WebDAV版)', 
      type: 'music', 
      actions: ['musicUrl'], 
      qualitys: ['128k', '320k'] 
    },
    kw: { 
      name: '酷我 (WebDAV版)', 
      type: 'music', 
      actions: ['musicUrl'], 
      qualitys: ['128k', '320k'] 
    },
    tx: { 
      name: 'QQ音乐 (WebDAV版)', 
      type: 'music', 
      actions: ['musicUrl'], 
      qualitys: ['128k', '320k'] 
    },
    mg:{ 
      name: '咪咕音乐 (WebDAV版)', 
      type: 'music', 
      actions: ['musicUrl'], 
      qualitys: ['128k', '320k'] 
    },
    local:{ 
      name: '本地音乐', 
      type: 'music', 
      actions: ['musicUrl', 'lyric', 'pic'], 
      qualitys: ['128k', '320k'] 
    },
  }
})

// 异步初始化音乐列表
initMusicList().then(() => {
  console.log('✅ 音乐列表加载完成')
}).catch(error => {
  console.error('❌ 加载音乐列表失败:', error)
})