var wasm = require("../../utils/wasm");
var cv;
var listener;
Page({

  data: {

  },
  getwasm: function () {
    wasm.init({
      url:"http://www.aiotforest.com/opencv.zip",
      type:"zip", //格式：wasm,zip
      useCache:true, //是否使用缓存
      self:this,
      success: function (Module) {
        cv=Module;
        console.log(cv);
      }
    })
  },
  getgray: function () {
    cv.imread("http://www.aiotforest.com/lena.png",function(mat){
      let src = mat;
      let dstx = new cv.Mat();
      cv.cvtColor(src, src, cv.COLOR_RGB2GRAY, 0);
      cv.imshow(src);
      src.delete(); 
      dstx.delete();
    });
  },
  getcamera:function(){
    var self=this;
    if(!this.facexmlflag){
      this.facexmlflag=true;
      wx.downloadFile({
        url: 'http://www.aiotforest.com/haarcascade_frontalface_default.xml',
        filePath:cv.USER_DATA_PATH+"/haarcascade_frontalface_default.xml",
        success:function(){
          self.faceflag=true;
        }
      })
    }
    if(!this.eyesxmlflag){
      this.eyesxmlflag=true;
      wx.downloadFile({
        url: 'http://www.aiotforest.com/haarcascade_eye.xml',
        filePath:cv.USER_DATA_PATH+"/haarcascade_eye.xml",
        success:function(){
          self.eyesflag=true;
        }
      })
    }
    if(this.faceflag&&this.eyesflag){
      cv.FS_createDataFile("/", "haarcascade_frontalface_default.xml", new Uint8Array(cv.FSM.readFileSync(cv.USER_DATA_PATH+"haarcascade_frontalface_default.xml")), true, false, undefined);
      self.faceCascade = new cv.CascadeClassifier();
      self.faceCascade.load("/haarcascade_frontalface_default.xml");

      cv.FS_createDataFile("/", "haarcascade_eye.xml", new Uint8Array(cv.FSM.readFileSync(cv.USER_DATA_PATH+"haarcascade_eye.xml")), true, false, undefined);
      self.eyesCascade = new cv.CascadeClassifier();
      self.eyesCascade.load("/haarcascade_eye.xml");

      const context = wx.createCameraContext()
      listener = context.onCameraFrame((frame) => {
        self.cameraData=frame;
      })
      listener.start();
      self.detectloop();
    }else{
      setTimeout(this.getcamera,100);
    }
  },
  facexmlflag:false,
  eyesxmlflag:false,
  faceflag:false,
  eyesflag:false,
  cameraData:undefined,
  detectloop:function(){
    var self=this;
    if(typeof self.cameraData=="object"){
      self.detectFace(self.cameraData);
      setTimeout(self.detectloop,0);
    }else{
      setTimeout(self.detectloop,100);
    }
  },
  detectFace:function(frame){
    var self=this;
    var src = cv.matFromImageData({
      data:new Uint8ClampedArray(frame.data),
      width:frame.width,
      height:frame.height
    });
    var gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    var faces = new cv.RectVector();
    let eyes = new cv.RectVector();
    var faceCascade = self.faceCascade;
    faceCascade.detectMultiScale(gray, faces, 1.1, 5, 0);
    for (var i = 0; i < faces.size(); ++i) {
        var roiGray = gray.roi(faces.get(i));
        var roiSrc = src.roi(faces.get(i));
        var point1 = new cv.Point(faces.get(i).x, faces.get(i).y);
        var point2 = new cv.Point(faces.get(i).x + faces.get(i).width,
                                  faces.get(i).y + faces.get(i).height);
        cv.rectangle(src, point1, point2, [255, 0, 0, 255]);
        
        var eyesCascade = self.eyesCascade;
        eyesCascade.detectMultiScale(roiGray, eyes);
        for (let j = 0; j < eyes.size(); ++j) {
          let point1 = new cv.Point(eyes.get(j).x, eyes.get(j).y);
          let point2 = new cv.Point(eyes.get(j).x + eyes.get(j).width,
              eyes.get(j).y + eyes.get(j).height);
          cv.rectangle(roiSrc, point1, point2, [0, 0, 255, 255]);
        }

        roiGray.delete(); 
        roiSrc.delete();
    }
    cv.imshow(src);
    src.delete(); 
    gray.delete(); 
    faces.delete();
  },
  stop:function(){
    listener.stop();
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})