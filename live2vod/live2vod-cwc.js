/**
 * live2vod-cwc.js
 * 配置设置 {"key":"直播转点播","name":"直播转点播","type":3,"api":"./live2vod/live2vod_cwc.js","searchable":0,"quickSearch":0,"filterable":0,"timeout": 30, "ext":"./live2vod/live.json;showHomeVod=0"}
[
{"name":"relative_path","url":"./mv.txt"},
{"name": "txt",     "url": "http://www.abc.com/live.txt"},
{"name": "m3u",     "url": "www.abc.com/live.m3u"}
]
 * ext文件格式为json列表,name,url参数
[
    {"name":"纪录","url":"./documentary.txt"},
    {"name":"Demo","url":"./demo.txt"}
]
 */
const request_timeout = 5000;
const VERSION = 'live2vod-cwc-20240628';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
const __ext = {data_dict:{}};
const tips = `\nVersion: ${VERSION}`;
//const def_pic = 'https://avatars.githubusercontent.com/u/97389433?s=120&v=4';
const def_pic = '';
let hostUrl = "";
let showHomeVod = true;

/**
 * 打印日志
 * @param any 任意变量
 */
function print(any){
    any = any||'';
    if(typeof(any)=='object'&&Object.keys(any).length>0){
        try {
            any = JSON.stringify(any);
            console.log(any);
        }catch (e) {
            // console.log('print:'+e.message);
            console.log(typeof(any)+':'+any.length);
        }
    }else if(typeof(any)=='object'&&Object.keys(any).length<1){
        console.log('null object');
    }else{
        console.log(any);
    }
}

/**
 * 获取链接的host(带http协议的完整链接)
 * @param url 任意一个正常完整的Url,自动提取根
 * @returns {string}
 */
function getHome(url){
    if(!url){
        return ''
    }
    if (url.startsWith('http')) {
        let tmp = url.split('//');
        url = tmp[0] + '//' + tmp[1].split('/')[0];
        try {
            url = decodeURIComponent(url);
        }catch (e) {}
    }
    return url
}

/**
 * m3u直播格式转一般直播格式
 * @param m3u
 * @returns {string}
 */
function convertM3uToNormal(m3u) {
    try {
      const lines = m3u.split('\n');
      let result = '';
      let TV='';
      // let flag='#genre#';
      let flag='#m3u#';
      let currentGroupTitle = '';
      lines.forEach((line) => {
        if (line.startsWith('#EXTINF:')) {
          const groupTitle = line.split('"')[1].trim();
          TV= line.split('"')[2].substring(1);
          if (currentGroupTitle !== groupTitle) {
            currentGroupTitle = groupTitle;
            result += `\n${currentGroupTitle},${flag}\n`;
          }
        } else if (line.startsWith('http')) {
          const splitLine = line.split(',');
          result += `${TV}\,${splitLine[0]}\n`;
        }
      });
      return result.trim();
  }catch (e) {
    print(`m3u直播转普通直播发生错误:${e.message}`);
    return m3u
    }
}

const http = function (url, options = {}) {
    if(options.method ==='POST' && options.data){
        options.body = JSON.stringify(options.data);
        options.headers = Object.assign({'content-type':'application/json; charset=utf-8'}, options.headers);
    }
    options.timeout = request_timeout;
    if(!options.headers){
        options.headers = {};
    }
    let keys = Object.keys(options.headers).map(it=>it.toLowerCase());
    if (!url.startsWith('http')) {
        url = hostUrl + url;
    }
    print("url=" + url);
        
    if(!keys.includes('referer')){
        options.headers['Referer'] = getHome(url);
    }
    if(!keys.includes('user-agent')){
        options.headers['User-Agent'] = UA;
    }
    console.log(JSON.stringify(options.headers));
    try {
        const res = req(url, options);
        // if(options.headers['Authorization']){
        //  console.log(res.content);
        // }
        res.json = () => res&&res.content ? JSON.parse(res.content) : null;
        res.text = () => res&&res.content ? res.content:'';
        return res
    }catch (e) {
        return {
            json() {
                return null
            }, text() {
                return ''
            }
        }
    }
};
["get", "post"].forEach(method => {
    http[method] = function (url, options = {}) {
        return http(url, Object.assign(options, {method: method.toUpperCase()}));
    }
});

function init(ext) {
    let data;
    if (typeof ext == 'object'){
        data = ext;
        print('live ext:object');
    } else if (typeof ext == 'string') {
        if (ext.startsWith('http')) {
            let ext_params = ext.split(';');
            let data_url = ext_params[0];
            if (ext_params.length == 2) {
                showHomeVod = false;
            }
            hostUrl = data_url.substring(0, data_url.lastIndexOf('/')+1);
            data = http.get(data_url).json();
        }
    }
    print(data);
    __ext.data = data;
}

function home(filter) {
    let classes = __ext.data.map(it => ({
        type_id: it.url,
        type_name: it.name,
    }));
    let filter_dict = {};
    return JSON.stringify({ 'class': classes,'filters': filter_dict});
}

function processCategory(_get_url) {
    let html;
    if(__ext.data_dict[_get_url]){
        html = __ext.data_dict[_get_url];
    }else{
        html = http.get(_get_url).text();
        if(/#EXTM3U/.test(html)){
            html = convertM3uToNormal(html);
        }
        __ext.data_dict[_get_url] = html;
    }
    // let arr = html.match(/.*?[,，]#[\s\S].*?#/g);
    let arr = html.match(/.*?[,，]#[\s\S].*?#/g); // 可能存在中文逗号
    let _list = [];
    try {
        arr.forEach(it=>{
            let vname = it.split(/[,，]/)[0];
            let vtab = it.match(/#(.*?)#/)[0];
            _list.push({
                // vod_name:it.split(',')[0],
                vod_name:vname,
                vod_id:_get_url+'$'+vname,
                vod_pic:def_pic,
                //vod_remarks:vtab
            });
        });
    }catch (e) {
        print('live2vod-cwc获取一级分类页发生错误:'+e.message);
    }
    return _list;
}

function homeVod(params) {
    if (showHomeVod) {
        let _list = processCategory(__ext.data[0].url);
        return JSON.stringify({ 'list': _list });
    }
    else {
        return JSON.stringify({ 'list': '' });
    }
}

function category(tid, pg, filter, extend) {
    if(parseInt(pg)>1){
        return JSON.stringify({
            'list': []
        });
    }
    let _list = processCategory(tid);
    return JSON.stringify({
        'page': 1,
        'pagecount': 1,
        'limit': _list.length,
        'total': _list.length,
        'list': _list,
    });
}

function detail(tid) {
    let _get_url = tid.split('$')[0];
    let _tab = tid.split('$')[1];
    let html;
    if(__ext.data_dict[_get_url]){
        html = __ext.data_dict[_get_url];
    }else{
        html = http.get(_get_url).text();
        if(/#EXTM3U/.test(html)){
            html = convertM3uToNormal(html);
        }
        __ext.data_dict[_get_url] = html;
    }
    // let a = new RegExp(`.*?${_tab},#[\\s\\S].*?#`);
    let a = new RegExp(`.*?${_tab.replace('(','\\(').replace(')','\\)')}[,，]#[\\s\\S].*?#`);
    let b = html.match(a)[0]; //Category Name,#genre#
    let c = html.split(b)[1];
    if(c.match(/.*?[,，]#[\s\S].*?#/)){
        let d = c.match(/.*?[,，]#[\s\S].*?#/)[0];
        c = c.split(d)[0];
    }
    let arr = c.trim().split('\n');
    let _list = [];
    arr.forEach((it)=>{
        if(it.trim()){
            let t = it.trim().split(',')[0]; //Channel Name
            let u = it.trim().split(',')[1]; //Channel URL
            _list.push(t+'$'+u);
        }
    });

    let vod_name = __ext.data.find(x=>x.url===_get_url).name;
    let vod_play_url = _list.join('#');
    let vod_play_from = vod_name;
    let vod = {
        vod_id: tid,
        vod_name: vod_name+'|'+_tab,
        type_name: "直播列表",
        vod_pic: def_pic,
        vod_content: tid,
        vod_play_from: vod_play_from,
        vod_play_url: vod_play_url,
        //vod_director: 'cwc',
        vod_remarks: tips
    };

    return JSON.stringify({
        list: [vod]
    });
}

function play(flag, id, flags) {
    let vod = {
        'parse': /m3u8/.test(id)?0:1,
        'playUrl': '',
        'url': id
    };
    print(vod);
    return JSON.stringify(vod);
}

function search(wd, quick) {
    //Don't support search
    return JSON.stringify({'list': ''});
}

export default {
    init: init,
    home: home,
    homeVod: homeVod,
    category: category,
    detail: detail,
    play: play,
    search: search
}
