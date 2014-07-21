//地图联动
var GisObjListMgr = GisObjListMgr || {};
(function(GISOBJLISTMGR) {
    var mapPlugObjList = new GISHashMap();
    var mapPlugSwitchList = new GISHashMap();
    var cross = false;// 十字对比线
    // 设置地图联动开关
    var setMapLinkageSwitch = function(mapPlugin, mode, crossLine) {
        if (typeof crossLine != 'undefined') {
            cross = crossLine;
        }
        if (!mode) {
            cross = false;
            for ( var i = GisObjListMgr.mapPlugObjList.get(mapPlugin).size() - 1; i >= 0; i--) {
                var _mapMgr = GisObjListMgr.mapPlugObjList.get(mapPlugin).vals[i];
                _mapMgr.getCrossLineLayerObj().removeAllFeatures({
                    silent : true
                });
            }
        }
        mapPlugSwitchList.put(mapPlugin, mode);
    };
    var removeMapObj = function(mapPlugin, mapDivId) {
        if (!mapPlugObjList.containsKey(mapPlugin)) {
            return false;
        }
        var mapObjList = mapPlugObjList.get(mapPlugin);
        if (mapObjList.containsKey(mapDivId)) {
//            mapObjList.get(mapDivId).reSetMap();
            // mapObjList.get(mapDivId)
            return mapObjList.remove(mapDivId);
        }
        return false;
    };
    var removeMapPlugin = function(mapPlugin) {
        if (!mapPlugObjList.containsKey(mapPlugin)) {
            return false;
        }
        mapPlugObjList.remove(mapPlugin);
        mapPlugSwitchList.remove(mapPlugin);
        return true;
    };
    var getCross = function() {
        return cross;
    };
    GISOBJLISTMGR.mapPlugObjList = mapPlugObjList;
    GISOBJLISTMGR.mapPlugSwitchList = mapPlugSwitchList;
    GISOBJLISTMGR.getCross = getCross;
    GISOBJLISTMGR.setMapLinkageSwitch = setMapLinkageSwitch;
    GISOBJLISTMGR.removeMapPlugin = removeMapPlugin;
    GISOBJLISTMGR.removeMapObj = removeMapObj;
})(GisObjListMgr);

function LayerItem(layerId, layerParmObj, refreshDataCallBackFunc) {
    // 图层ID
    this.layerId = layerId;
    // 用于控制异步并发刷新页面，用来保证只有最后一次刷新操作的数据才会刷新到地图上
    this.seqObj = new GISSequence();
    // 图层参数，回调会传回给refreshDataCallBackFunc
    this.layerParms = layerParmObj;
    // 移动地图后刷新数据的回调函数,如果为undefine.表示无需回调
    this.refreshDataCallBackFunc = refreshDataCallBackFunc;
    // 图层插件对象
    this.layerPlugObj = null;
    // Openlayer图层对象,是插件layerPlugObj.layerObj里的引用
    this.layerObj = null;
    // 图层是否可见
    this.visibleInd = true;
    // 关联图层，当前只有小区关联基站图层
    // 修改，此属性为一个list，包含所有的关联图层：如小区图层对应的markerLayer
    this.refLayerId = null;
};

function MapAppParm() {
    // 地图上显示为小区还是基站
    /**
     * @param _mapPlug
     * @returns {GISMap}
     */
    this.cellMode = true;
    this.maxZoomLever = 18;
    // 增加minZoomLevel
    this.minZoomLever = 1;
    // 增加是比例尺还是地图枚举的
    this.isLever = true;

    // 进入 单个图层多个feature选择模式
    this.multiSelectMode = false;
    // 地图类型
    this.mapType = 0;
    // 来自配置业务图层参数
    this.neRangStart = 1;
    this.neRangEnd = 15;
    this.siteRangStart = 1;
    this.siteRangEnd = 18;
    this.cellRangStart = 1;
    this.cellRangEnd = 18;
    this.cellCoverRangStart = 5;
    this.cellCoverRangEnd = 16;
    this.gridRangStart = 12;
    this.gridRangEnd = 18;
    this.roundedGridRangStart = 12;
    this.roundedGridRangEnd = 18;
    this.eventRangStart = 8;
    this.eventRangEnd = 17;
    this.rasterRangStart = 10;
    this.rasterRangEnd = 17;
    this.customRangStart = 10;
    this.customRangEnd = 17;
    this.neLableMinZoomLever = 1;
    this.siteLableMinZoomLever = 1;
    this.cellLableMinZoomLever = 1;
    this.adjustRate = 1;// 小区微调参数
    this.measurementColor = '#FF0000';
};

// 一个DIV对应的GISMap类,地图操作入口
function GISMap(_mapPlug) {
    var issupportlinestringclick = false; // 全局变量，确保切换地图后，多边形能正常点击
    var highlightPolygonName = null;
    var resetContent = null; // 执行nastart回调函数，规避缩放后事件丢失问题, 此回调函数在地图缩放结束后会执行。
    var gridClick = false;
    // 国际化，目前在bing地图中使用
    globalGisCulture = null;
    var callbackFuctionForCustomPop = null; // 定制弹框出要执行的回调函数【sonmaster】
    var currentFeatrue = null;
    var mapPlug = _mapPlug;
    var boomType = new GISHashMap();
    // CBB后台缓存管理类
    var cbbBusinessMgr = null;
    // 地图管理类
    var mapMgrObj = null;
    // OpenLayers.Map对象实例,GISMgr.mapObj的引用
    var mapObj = null;
    // OpenLayers.Map对象实例的业务图层的HashMap数据，不包括地图图层,key为业务图层ID
    var layermap = new GISHashMap();
    // 显示数据的地图区间,当前是地图可见部分上下分别加可见高度*0.5,左右分别加可见宽度*0.5
    var dataMapExtent = null;
    var zoomLevel = null;
    // 需要对外暴露应用图层的参数
    var mapAppParmObj = new MapAppParm();
    // 性能考虑，避免不必要的刷新业务图层，锁定后不会调用刷新业务图层
    var lockRefreshInd = false;
    // 表示是否正在处理 地图移动或缩放导致的图层刷新
    var refreshingInd = false;
    // 创建对象组下多选图层
    var multiSelectLayerId = null;

    // 手动加站开关
    var isAddSiteMode = false;
    // 点击返回经纬度开关
    var isClickpointStr = false;
    var callBackEve = null;
    // 修改多边形
    var isModifyPoygon = false;
    // 点击地图的经纬度
    var curclickpointStr = null;

    // 手动在地图上删除站点开关，开关，值为true时进入手动加站模式，点击即可增加站点
    var isDeleteSiteMode = false;

    // 当前加站的基站图层ID
    var curAddSiteLayerId = null;

    // 当前加站的小区图层ID
    var curAddCellLayerId = null;

    // 获取小区具体信息的回调事件, 即加站时点击的事件
    var addSiteInfoCallBackFunc = null;

    // 设置加站的类型等参数，主要是需要加的小区类型，是哪一中制式
    var addSiteParam = null;

    // 移动基站的控制对象数组
    var moveSiteControls = [];
    // 移动自定义图形控制对象数组
    var moveCustomerControls = [];

    // 加站完成后回调函数
    var callBackFuncAfterAddSite = null;

    // 删站完成后回调函数
    var callBackFuncAfterDeleteSite = null;

    // 线环点字符串
    var linearRingVertiesStr = null;

    // 自定义图形平移后经纬度及平移距离
    var customerMoveSpace = {};

    // 存放地图的ID
    var mapDivId_ = null;

    /**
     * 管理zone任务创建的图层
     */
    var zoneLayerList = new GISHashMap();
    /**
     * 管理多边形创建的图层
     */
    var polygonLayerList = new GISHashMap();
    /**
     * 存放多边形外框线
     */
    var polygonLineLayerList = new GISHashMap();
    /**
     * 存放多边形内marker图层
     */
    var markerLayerList = new GISHashMap();

    /**
     * 管理多边形顶点。
     */
    var polygonVertiesList = new GISHashMap();

    /**
     * 存放多边形中心点经纬度。
     */
    var polygonCenterLonLatList = new GISHashMap();

    /**
     * 管理多边形颜色。
     */
    var polygonColorList = new GISHashMap();

    /**
     * 多边形高亮定时器。
     */
    var interval = null;

    /**
     * 存放多边形边框图层。
     */
    var layerPolygonLineVector = [];
    /**
     * 存放多边形图层。
     */
    var layerPolygonVector = [];

    /**
     * 存放多边形中markers图层。
     */
    var layerMarkers = [];

    // 事件柄
    var eventHandlerFuncs = null;

    /**
     * 地图工具测量夹角图层
     */
    var angleLayer = null;

    /**
     * 地图工具画夹角control
     */
    var drawAngleControl = null;

    /**
     * 判断地图单双击的定时器
     */
    var clickTimerFn = null;

    /**
     * 自定义图形管理类
     */
    var customerLayerList = new GISHashMap();
    /**
     * 
     */
    var lonLatList = new GISHashMap();
    /**
     * 地图用户自定义点击事件标志
     */
    var customerClickFlag = false;
    var customerFlag = false;
    /**
     * 地图用户自定义移动事件标志
     */
    var customerMoveendFlag = false;
    /**
     * 地图用户自定义鼠标移动事件标志
     */
    var customerMouseMoveFlag = false;
    /**
     * 地图用户自定义事件回调函数
     */
    var customerMouseCallBack = null;

    /**
     * 地图用户自定义Mousemove事件回调函数
     */
    var customerMouseMoveCallBack = null;

    var polygonVisibleLevel = 0; // 多边形及多边形边框可视级别
    var markerVisibleLevel = 0; // 多边形中marker可视级别

    // 所需要修改的线图层Id
    var modefityLinelayerId = null;

    /**
     * 是不是地图拖动事件标志
     */
    var isMapMouseMove = false;
    /**
     * 删除zone任务创建的图层
     */
    var removeZoneLayerList = function(layerid) {
        if (zoneLayerList.containsKey(layerid)) {
            return zoneLayerList.remove(layerid);
        }
        return false;
    };

    /**
     * 删除多边形任务创建的图层
     */
    var removePolygonLayerList = function(layerid) {
        if (polygonLayerList.containsKey(layerid)) {
            return polygonLayerList.remove(layerid);
        }
        return false;
    };
    /**
     * 删除指定ID的多边形外框线
     */
    var removePolygonLineLayerList = function(layerid) {
        if (polygonLineLayerList.containsKey(layerid)) {
            return polygonLineLayerList.remove(layerid);
        }
        return false;
    };
    var removeMarkerLayerList = function(layerid) {
        if (markerLayerList.containsKey(layerid)) {
            return markerLayerList.remove(layerid);
        }
        return false;
    };

    /**
     * 删除指定多边形顶点。
     */
    var removePolygonVertiesList = function(layerid) {
        if (polygonVertiesList.containsKey(layerid)) {
            return polygonVertiesList.remove(layerid);
        }
        return false;
    };

    // 设置业务图层的参数
    var setLayerProperties = function(mapParmObj) {
        // 添加是比例尺还是Lever
        var isLever = (typeof (mapParmObj.isLever) == "undefined") ? true
                : mapParmObj.isLever;
        if (isLever) {
            mapAppParmObj.maxZoomLever = parseInt(mapParmObj.maxZoomLever);
            mapAppParmObj.minZoomLever = (typeof (mapParmObj.minZoomLever) == "undefined") ? 1
                    : parseInt(mapParmObj.minZoomLever);
            mapAppParmObj.mapType = parseInt(mapParmObj.type);
            mapAppParmObj.adjustRate = parseInt(mapParmObj.adjustRate);
            mapAppParmObj.measurementColor = mapParmObj.measurementColor;
            mapAppParmObj.neRangStart = parseInt(mapParmObj.neRangStart);
            mapAppParmObj.neRangEnd = parseInt(mapParmObj.neRangEnd);
            mapAppParmObj.siteRangStart = parseInt(mapParmObj.siteRangStart);
            mapAppParmObj.siteRangEnd = parseInt(mapParmObj.siteRangEnd);
            mapAppParmObj.cellRangStart = parseInt(mapParmObj.cellRangStart);
            if (typeof (mapParmObj.cellRangBigger) != "undefined") {
                mapAppParmObj.cellRangBigger = parseInt(mapParmObj.cellRangBigger);
            }
            mapAppParmObj.cellRangEnd = parseInt(mapParmObj.cellRangEnd);
            mapAppParmObj.cellCoverRangStart = parseInt(mapParmObj.cellCoverRangStart);
            mapAppParmObj.cellCoverRangEnd = parseInt(mapParmObj.cellCoverRangEnd);
            mapAppParmObj.gridRangStart = parseInt(mapParmObj.gridRangStart);
            mapAppParmObj.gridRangEnd = parseInt(mapParmObj.gridRangEnd);
            mapAppParmObj.roundedGridRangStart = parseInt(mapParmObj.roundedGridRangStart);
            mapAppParmObj.roundedGridRangEnd = parseInt(mapParmObj.roundedGridRangEnd);
            mapAppParmObj.eventRangStart = parseInt(mapParmObj.eventRangStart);
            mapAppParmObj.eventRangEnd = parseInt(mapParmObj.eventRangEnd);
            mapAppParmObj.rasterRangStart = parseInt(mapParmObj.rasterRangStart);
            mapAppParmObj.rasterRangEnd = parseInt(mapParmObj.rasterRangEnd);
            mapAppParmObj.customRangStart = parseInt(mapParmObj.customRangStart);
            mapAppParmObj.customRangEnd = parseInt(mapParmObj.customRangEnd);
            mapAppParmObj.neLableMinZoomLever = parseInt(mapParmObj.neLableMinZoomLever);
            mapAppParmObj.siteLableMinZoomLever = parseInt(mapParmObj.siteLableMinZoomLever);
            mapAppParmObj.cellLableMinZoomLever = parseInt(mapParmObj.cellLableMinZoomLever);
        } else {
            // 获取初始化地图时根据选择的地图初始化地图枚举与比例尺对应关系
            boomType = mapMgrObj.chooseBoomByMapType(mapParmObj);
            mapAppParmObj.maxZoomLever = boomType.get(mapParmObj.maxZoomLever);
            // add minZoomLever
            mapAppParmObj.minZoomLever = (typeof (mapParmObj.minZoomLever) == "undefined") ? 1
                    : boomType.get(mapParmObj.minZoomLever);
            mapAppParmObj.mapType = parseInt(mapParmObj.type);
            mapAppParmObj.adjustRate = boomType.get(mapParmObj.adjustRate);
            mapAppParmObj.measurementColor = mapParmObj.measurementColor;
            mapAppParmObj.neRangStart = boomType.get(mapParmObj.neRangStart);
            mapAppParmObj.neRangEnd = boomType.get(mapParmObj.neRangEnd);
            mapAppParmObj.siteRangStart = boomType
                    .get(mapParmObj.siteRangStart);
            mapAppParmObj.siteRangEnd = boomType.get(mapParmObj.siteRangEnd);
            mapAppParmObj.cellRangStart = boomType
                    .get(mapParmObj.cellRangStart);
            if (typeof (mapParmObj.cellRangBigger) != "undefined") {
                mapAppParmObj.cellRangBigger = parseInt(mapParmObj.cellRangBigger);
            }
            mapAppParmObj.cellRangEnd = boomType.get(mapParmObj.cellRangEnd);
            mapAppParmObj.cellCoverRangStart = boomType
                    .get(mapParmObj.cellCoverRangStart);
            mapAppParmObj.cellCoverRangEnd = boomType
                    .get(mapParmObj.cellCoverRangEnd);
            mapAppParmObj.gridRangStart = boomType
                    .get(mapParmObj.gridRangStart);
            mapAppParmObj.gridRangEnd = boomType.get(mapParmObj.gridRangEnd);
            mapAppParmObj.roundedGridRangStart = boomType
                    .get(mapParmObj.roundedGridRangStart);
            mapAppParmObj.roundedGridRangEnd = boomType
                    .get(mapParmObj.roundedGridRangEnd);
            mapAppParmObj.eventRangStart = boomType
                    .get(mapParmObj.eventRangStart);
            mapAppParmObj.eventRangEnd = boomType.get(mapParmObj.eventRangEnd);
            mapAppParmObj.rasterRangStart = boomType
                    .get(mapParmObj.rasterRangStart);
            mapAppParmObj.rasterRangEnd = boomType
                    .get(mapParmObj.rasterRangEnd);
            mapAppParmObj.customRangStart = boomType
                    .get(mapParmObj.customRangStart);
            mapAppParmObj.customRangEnd = boomType
                    .get(mapParmObj.customRangEnd);
            mapAppParmObj.neLableMinZoomLever = boomType
                    .get(mapParmObj.neLableMinZoomLever);
            mapAppParmObj.siteLableMinZoomLever = boomType
                    .get(mapParmObj.siteLableMinZoomLever);
            mapAppParmObj.cellLableMinZoomLever = boomType
                    .get(mapParmObj.cellLableMinZoomLever);
        }

    };

    var setLayerVisibleRange = function(layerType, param) {
        switch (layerType) {
        case GisLayerType.NE:
            mapAppParmObj.neRangStart = parseInt(isNaN(param.rangStart) ? mapAppParmObj.neRangStart
                    : param.rangStart);
            mapAppParmObj.neRangEnd = parseInt(isNaN(param.rangEnd) ? mapAppParmObj.neRangEnd
                    : param.rangEnd);
            break;
        case GisLayerType.SITE:
            mapAppParmObj.siteRangStart = parseInt(isNaN(param.rangStart) ? mapAppParmObj.siteRangStart
                    : param.rangStart);
            mapAppParmObj.siteRangEnd = parseInt(isNaN(param.rangEnd) ? mapAppParmObj.siteRangEnd
                    : param.rangEnd);
            break;
        case GisLayerType.CELL:
            mapAppParmObj.cellRangStart = parseInt(isNaN(param.rangStart) ? mapAppParmObj.cellRangStart
                    : param.rangStart);
            mapAppParmObj.cellRangEnd = parseInt(isNaN(param.rangEnd) ? mapAppParmObj.cellRangEnd
                    : param.rangEnd);
            break;
        case GisLayerType.CELLCOVER:
            mapAppParmObj.cellCoverRangStart = parseInt(isNaN(param.rangStart) ? mapAppParmObj.cellCoverRangStart
                    : param.rangStart);
            mapAppParmObj.cellCoverRangEnd = parseInt(isNaN(param.rangEnd) ? mapAppParmObj.cellCoverRangEnd
                    : param.rangEnd);
            break;
        case GisLayerType.EVENT:
            mapAppParmObj.eventRangStart = parseInt(isNaN(param.rangStart) ? mapAppParmObj.eventRangStart
                    : param.rangStart);
            mapAppParmObj.eventRangEnd = parseInt(isNaN(param.rangEnd) ? mapAppParmObj.eventRangEnd
                    : param.rangEnd);
            break;
        case GisLayerType.GRID:
            mapAppParmObj.gridRangStart = parseInt(isNaN(param.rangStart) ? mapAppParmObj.gridRangStart
                    : param.rangStart);
            mapAppParmObj.gridRangEnd = parseInt(isNaN(param.rangEnd) ? mapAppParmObj.gridRangEnd
                    : param.rangEnd);
            break;
        case GisLayerType.RASTER:
            mapAppParmObj.rasterRangStart = parseInt(isNaN(param.rangStart) ? mapAppParmObj.rasterRangStart
                    : param.rangStart);
            mapAppParmObj.rasterRangEnd = parseInt(isNaN(param.rangEnd) ? mapAppParmObj.rasterRangEnd
                    : param.rangEnd);
            break;
        case GisLayerType.CUSTOMGRAPHIC:
            mapAppParmObj.customRangStart = parseInt(isNaN(param.rangStart) ? mapAppParmObj.customRangStart
                    : param.rangStart);
            mapAppParmObj.customRangEnd = parseInt(isNaN(param.rangEnd) ? mapAppParmObj.customRangEnd
                    : param.rangEnd);
            break;
        case GisLayerType.ROUNDEDGRID:
            mapAppParmObj.roundedGridRangStart = parseInt(isNaN(param.rangStart) ? mapAppParmObj.roundedGridRangStart
                    : param.rangStart);
            mapAppParmObj.roundedGridRangEnd = parseInt(isNaN(param.rangEnd) ? mapAppParmObj.roundedGridRangEnd
                    : param.rangEnd);
            break;
        default:
            return;
        }
        ;
    };

    var setLableMinZoomLever = function(layerType, lableMinZoomLever) {
        switch (layerType) {
        case GisLayerType.NE:
            mapAppParmObj.neLableMinZoomLever = parseInt(isNaN(lableMinZoomLever) ? mapAppParmObj.neLableMinZoomLever
                    : lableMinZoomLever);
            break;
        case GisLayerType.SITE:
            mapAppParmObj.siteLableMinZoomLever = parseInt(isNaN(lableMinZoomLever) ? mapAppParmObj.siteLableMinZoomLever
                    : lableMinZoomLever);
            break;
        case GisLayerType.CELL:
            mapAppParmObj.cellLableMinZoomLever = parseInt(isNaN(lableMinZoomLever) ? mapAppParmObj.cellLableMinZoomLever
                    : lableMinZoomLever);
            break;
        default:
            return;
        }
    };
    // 调用openlayers API建立Openlayer地图根据参数建立不同类型的地图
    /*
     * 参数分别是 mapDiv：显示地图的html div ID scaleDiv: 显示比例尺的html div ID
     * positionDiv:显示鼠标经纬度的html div ID mapParmObj：地图的json参数
     * messages：经纬度标签描述和比例尺单位标签描述，用于国际化
     */
    var initMap = function(divIds, mapParmObj, messages) {
        mapDivId_ = divIds.mapDiv;
        if (cbbBusinessMgr == null) {
            try {
                cbbBusinessMgr = new CBBBusinessMgr();
            } catch (e) {
                console.log(e);
            }
        }
        if (mapMgrObj == null) {
            mapMgrObj = new MapMgr();
            this.mapMgrObj = mapMgrObj;
        }

        var isSuccess = false;
        try {
            if (globalGisCulture == 'zh-Hans') {
                isSuccess = mapMgrObj.initMap(divIds, mapParmObj, messages,
                        globalGisCulture);// 地图是否初始化成功
            } else {
                isSuccess = mapMgrObj.initMap(divIds, mapParmObj, messages,
                        'en-US');// 地图是否初始化成功
            }
        } catch (e) {
            if (mapMgrObj != null) {
                mapMgrObj.forceToResetMap();
            }
            reSetMap();
            // cbbBusinessMgr = null;
            // mapMgrObj = null;
            throw e;
        }

        mapObj = mapMgrObj.getMapObject();// 获取地图对象
        if (isSuccess && mapObj != null) {
            mapObj.events.register('movestart', this, mapMoveEvent);
            mapObj.events.register('moveend', this, refreshAllLayers);
            mapObj.events.register('click', this, mapClickFunc);
            mapObj.events.register('zoomend', this, updateAllPopupAfterZoom);
            mapObj.events.register('mousemove', this, mapMousemoveFunc);
            // 地图联动Strat
            var mapObjList = null;
            if (GisObjListMgr.mapPlugObjList.containsKey(mapPlug)) {
                mapObjList = GisObjListMgr.mapPlugObjList.get(mapPlug);
            } else {
                mapObjList = new GISHashMap();
                GisObjListMgr.mapPlugObjList.put(mapPlug, mapObjList);
                GisObjListMgr.mapPlugSwitchList.put(mapPlug, false);
            }
            mapObjList.put(divIds.mapDiv, mapMgrObj);
            // 地图联动End
        }
        setLayerProperties(mapParmObj); // RUANQ 设置地图及图层公共参数
        var mapdivId = document.getElementById(divIds.mapDiv);
        if (divIds.mousePositionCss != ""
                && typeof (divIds.mousePositionCss) != 'undefined') {
            // 鼠标移动坐标字体样式 支持标准CSS MousePosition
            // add by zhaoding 多窗口地图时会出问题，样式会乱
            for ( var i = 0; i < mapdivId.children[0].children.length; i++) {
                if (mapdivId.children[0].children[i].id
                        .indexOf('MousePosition') > 0) {
                    mapdivId.children[0].children[i].style.cssText += divIds.mousePositionCss;
                    break;
                }
            }
        }
        if (divIds.scaleLineCss != ""
                && typeof (divIds.scaleLineCss) != 'undefined') {
            // 比例尺字体样式 支持标准CSS ScaleLine
            // add by zhaoding 多窗口地图时会出问题，样式会乱
            for ( var i = 0; i < mapdivId.children[0].children.length; i++) {
                if (mapdivId.children[0].children[i].id.indexOf('ScaleLine') > 0) {
                    mapdivId.children[0].children[i].style.cssText += divIds.scaleLineCss;
                    break;
                }
            }
        }
        if (divIds.zoomLevelBoxCss != ""
                && typeof (divIds.zoomLevelBoxCss) != 'undefined') {
            // 地图级别字体样式 支持标准CSS ZoomLevelBox
            // add by zhaoding 多窗口地图时会出问题，样式会乱
            for ( var i = 0; i < mapdivId.children[0].children.length; i++) {
                if (mapdivId.children[0].children[i].id.indexOf('ZoomLevelBox') > 0) {
                    mapdivId.children[0].children[i].style.cssText += divIds.zoomLevelBoxCss;
                    break;
                }
            }
        }
        refreshSingleSelectCtlLayer(issupportlinestringclick); // resolve after map-type change, click polygon not show tips .
        updateAllPopupAfterZoom(); // resolve after map-type change, polygon highlight Disappear Issue.
        return isSuccess;
    };
    // 外部类：切换地图时需要重建地图时,用于内存变量销毁和内部参数传递
    var terminate = function(mapParmObj) {
        var compatibilityInd = false;
        if (mapMgrObj != null) {
            compatibilityInd = mapMgrObj.terminate(mapParmObj);
        }
        if (!compatibilityInd) {
            reSetMap();
        }
        return compatibilityInd;
    };

    var reSetMap = function() {
        // 不能重新new个对象,因为有this.layermap 引用 改对象
        var layerNum = layermap.size();
        for ( var i = 0; i < layerNum; i++) {
            var layerItem = layermap.vals[i];
            var layer = layerItem.layerPlugObj;
            if (layer.destroy) {
                layer.destroy();
            }
        }
        layermap.clear();
        setMeasurementMode(false);
        setPolygonControlMode(false);
        mapMgrObj.reSetMap();

        // clearLocalVar();
    };

    var clearLocalVar = function(){
        highlightPolygonName = null;
        resetContent = null; // 执行nastart回调函数，规避缩放后事件丢失问题, 此回调函数在地图缩放结束后会执行。
        callbackFuctionForCustomPop = null; // 定制弹框出要执行的回调函数【sonmaster】
        currentFeatrue = null;
        mapPlug = null;
        boomType = null;
        cbbBusinessMgr = null;
        mapMgrObj = null;
        mapObj = null;
        dataMapExtent = null;
        zoomLevel = null;
        mapAppParmObj = null;
        multiSelectLayerId = null;
        callBackEve = null;
        curclickpointStr = null;
        curAddSiteLayerId = null;
        curAddCellLayerId = null;
        addSiteInfoCallBackFunc = null;
        addSiteParam = null;
        moveSiteControls = null;
        moveCustomerControls = null;
        callBackFuncAfterAddSite = null;
        callBackFuncAfterDeleteSite = null;
        linearRingVertiesStr = null;
        customerMoveSpace = null;
        mapDivId_ = null;
        zoneLayerList = null;
        polygonLayerList = null;
        polygonLineLayerList = null;
        markerLayerList = null;
        polygonVertiesList = null;
        polygonCenterLonLatList = null;
        polygonColorList = null;
        interval = null;
        layerPolygonLineVector = null;
        layerPolygonVector = null;
        layerMarkers = null;
        eventHandlerFuncs = null;
        angleLayer = null;
        drawAngleControl = null;
        clickTimerFn = null;
        customerLayerList = null;
        lonLatList = null;
        customerMouseCallBack = null;
        customerMouseMoveCallBack = null;
    };
	
	var flagCell= true;
	var mapMoveEvent = function(e){
		if (e.object.dragging || flagCell || this.getLockRefreshInd()) {
            return;
        }
		var layermap = this.getLayermap();
		var layerItem = null;
		for (var i = 0; i < layermap.size(); i++) {
			layerItem = layermap.vals[i];
			layer = layerItem.layerPlugObj;
			if(layer.type == "CELL"){
				layer.removeAllFeatrue();
//				layer.refreshLayer();
			}
		}
		flagCell = true; 
	};
	// 地图放大/缩小/移动事件结束后回调函数,用于刷新所有图层.
	// 如果lockRefreshInd为true,将不会刷新
	// 可以通过refreshingInd变量判断是否正在做刷新
	// 后续如果有图层不需要刷新的需求,可添加字段判断不做刷新,该字段在建layer传入.
	var refreshAllLayers = function() {
		flagCell = false;
		// 获取当前的缩放比
		var curZoomLever = mapObj.getZoom();

        // 如果当前级别小于最小级别
        if (curZoomLever <= mapAppParmObj.minZoomLever) {
            mapObj.zoomTo(mapAppParmObj.minZoomLever);
        }
        // 如果当前级别大于最大级别
        if (curZoomLever >= mapAppParmObj.maxZoomLever) {
            mapObj.zoomTo(mapAppParmObj.maxZoomLever);
        }

        // RUANQ add by ruanqiang 设置多边形及多边形边框的可视级别
        if (curZoomLever < polygonVisibleLevel) {
            if (layerPolygonLineVector != null
                    && layerPolygonLineVector.length > 0
                    && layerPolygonVector != null
                    && layerPolygonVector.length > 0) {
                for ( var i = 0; i < markerLayerList.size(); i++) {
                    var layerName = markerLayerList.keys[i];
                    if (polygonLayerList.get(layerName) != null) {
                        polygonLayerList.get(layerName).display(false);
                    }
                    if (polygonLineLayerList.get(layerName) != null) {
                        polygonLineLayerList.get(layerName).display(false);
                    }
                }

            }
        } else if (curZoomLever >= polygonVisibleLevel && curZoomLever <= 18) {
            if (layerPolygonLineVector != null
                    && layerPolygonLineVector.length > 0
                    && layerPolygonVector != null
                    && layerPolygonVector.length > 0) {
                for ( var i = 0; i < markerLayerList.size(); i++) {
                    var layerName = markerLayerList.keys[i];
                    if (polygonLayerList.get(layerName) != null) {
                        polygonLayerList.get(layerName).display(true);
                    }
                    if (polygonLineLayerList.get(layerName) != null) {
                        polygonLineLayerList.get(layerName).display(true);
                    }
                }

            }
        }

        // RUANQ add by ruanqiang 设置多边形中marker的可视级别
        if (curZoomLever < markerVisibleLevel) {
            if (layerMarkers != null && layerMarkers.length > 0) {
                for ( var i = 0; i < markerLayerList.size(); i++) {
                    var layerName = markerLayerList.keys[i];
                    if (markerLayerList.get(layerName) != null) {
                        markerLayerList.get(layerName).display(false);
                    }
                }

            }
        } else if (curZoomLever >= markerVisibleLevel && curZoomLever <= 18) {
            if (layerMarkers != null && layerMarkers.length > 0) {
                for ( var i = 0; i < markerLayerList.size(); i++) {
                    var layerName = markerLayerList.keys[i];
                    if (markerLayerList.get(layerName) != null) {
                        markerLayerList.get(layerName).display(true);
                    }
                }

            }
        }

        if (currentFeatrue != null) {
            mapMgrObj.getSingleSelectCtl().unselect(currentFeatrue[0]); // RUANQ
            // 不选中
        }
        if (!this.getLockRefreshInd()) {
            var isOutSide = this.isOutSideDataExtent();
            var layermap = this.getLayermap();
            // removeAllPopup();//删除所有popup
            if (isOutSide) {
                // 调用各个图层回调函数刷新数据
                var layerItem = null;
                var dataExtents = this.getDataExtent();
                for ( var i = 0; i < layermap.size(); i++) {
                    layerItem = layermap.vals[i];
                    layer = layerItem.layerPlugObj;
                    if (isNotInRange(layerItem)) {
                        continue;
                    }
                    this.refreshLayerDataExtent(layerItem, dataExtents);
                }
            } else {
                // 调用各个图层刷新函数,后续优化可以只做显示的图层.
                this.setRefeshingInd(true);
                var layerItem = null;
                var layer;
                for ( var i = 0; i < layermap.size(); i++) {
                    layerItem = layermap.vals[i];
                    layer = layerItem.layerPlugObj;
                    if (layer != null && layerItem.visibleInd) {
                        layer.refreshLayer();
                    }
                }
                this.setRefeshingInd(false);
            }
            if (GisObjListMgr.mapPlugSwitchList.get(mapPlug)) {// 是否地图联动
                mapLinkaged();
            }
        }
    };
    var mapMousemoveFunc = function(event) {
        if (GisObjListMgr.getCross()) {
            if (GisObjListMgr.mapPlugObjList.get(mapPlug).size() < 2) {
                var _mapMgr = GisObjListMgr.mapPlugObjList.get(mapPlug).vals[0];
                _mapMgr.getCrossLineLayerObj().removeAllFeatures({
                    silent : true
                });
                return false;
            }
            var lonlat = mapObj.getLonLatFromPixel(event.xy);// 获取地图上鼠标点击的经纬度对象
            mapMgrObj.reTransform(lonlat);
            var dataExtents = mapObj.getExtent();
            mapMgrObj.reTransform(dataExtents);
            for ( var i = GisObjListMgr.mapPlugObjList.get(mapPlug).size() - 1; i >= 0; i--) {
                var _mapMgr = GisObjListMgr.mapPlugObjList.get(mapPlug).vals[i];
                _mapMgr.getCrossLineLayerObj().removeAllFeatures({
                    silent : true
                });
                if (GisObjListMgr.mapPlugSwitchList.get(mapPlug)) {// 是否地图联动
                    // 横线
                    var startPointRow = new OpenLayers.Geometry.Point(
                            dataExtents.left, lonlat.lat);
                    var endPointRow = new OpenLayers.Geometry.Point(
                            dataExtents.right, lonlat.lat);
                    var linestringRow = new OpenLayers.Geometry.LineString([
                            startPointRow, endPointRow]);
                    _mapMgr.transform(linestringRow);
                    // 竖线
                    var startPointCol = new OpenLayers.Geometry.Point(
                            lonlat.lon, dataExtents.top);
                    var endPointCol = new OpenLayers.Geometry.Point(lonlat.lon,
                            dataExtents.bottom);
                    var linestringCol = new OpenLayers.Geometry.LineString([
                            startPointCol, endPointCol]);
                    _mapMgr.transform(linestringCol);
                    itemVec = new OpenLayers.Feature.Vector(
                            new OpenLayers.Geometry.Collection([linestringRow,
                                    linestringCol]));
                    _mapMgr.getCrossLineLayerObj().addFeatures([itemVec]);
                }
            }
        }

        // 添加用户自定义事件
        if (customerMouseMoveFlag) {
            if (customerMouseMoveCallBack != null
                    && typeof (customerMouseMoveCallBack) == 'function'
                    && typeof (customerMouseMoveCallBack) != 'undefined') {
                var lonlat = mapObj.getLonLatFromPixel(event.xy);// 获取地图上鼠标点击的经纬度对象
                if (mapMgrObj.getTransformInd()) {
                    mapMgrObj.reTransform(lonlat);
                }
                customerMouseMoveCallBack(lonlat);
            }
        }
    };

    /**
     * 地图上空白区域点击事件回调的函数
     */
    var mapClickFunc = function(event) {
        removeAllPopup();
        clearTimeout(clickTimerFn);
        var thiss = this;
        clickTimerFn = setTimeout(
                function() {
                    // 单击执行以下代码
                    if (!thiss.getLockRefreshInd()) {
                        thiss.setRefeshingInd(true);
                        if (isAddSiteMode) { // 加站模式
                            addSiteClickFunc(event);
                        } else if (isModifyPoygon) {// 修改多边形
                            modofyPolygonClickFunc(event);
                        } else if (isClickpointStr) {
                            if (callBackEve != null
                                    && typeof (callBackEve) == 'function'
                                    && typeof (callBackEve) != 'undefined') {
                                var lonlat = mapObj
                                        .getLonLatFromPixel(event.xy);// 获取地图上鼠标点击的经纬度对象
                                if (mapMgrObj.getTransformInd()) {
                                    mapMgrObj.reTransform(lonlat);
                                }
                                callBackEve(lonlat);
                            }
                        } else if (customerClickFlag) {// 用户点击事件
                            if (customerMouseCallBack != null
                                    && typeof (customerMouseCallBack) == 'function'
                                    && typeof (customerMouseCallBack) != 'undefined') {
                                var lonlat = mapObj
                                        .getLonLatFromPixel(event.xy);// 获取地图上鼠标点击的经纬度对象
                                if (mapMgrObj.getTransformInd()) {
                                    mapMgrObj.reTransform(lonlat);
                                }
                                customerMouseCallBack(lonlat);
                            }
                        } else if (thiss
                                .getIsModifyLineAttribute(modefityLinelayerId)) {// 修改选择的线的属性
                            // 取消选中的线的属性
                            cancelLineChange(
                                    modefityLinelayerId,
                                    thiss
                                            .getSelectLineAttribute(modefityLinelayerId));
                        } else {
                            // 栅格点击
                            var controls = mapObj
                                    .getControlsByClass("OpenLayers.Control.WMSGetFeatureInfo");
                            gridClick = true;
                            // 云图化栅格不允许点击
                            if (controls != null
                                    && controls.length > 0
                                    && controls[0].layers != null
                                    && GridDataType.GRID_NEPHOGRAM != controls[0].layers[0].params.GRIDTYPE) {
                                controls[0].activate();
                                controls[0].handler.click(event);
                            }
                        }
                        thiss.setRefeshingInd(false);
                    }
                }, 300);
    };
    /** ****************************************多边形业务，修改多边形****************************************** */

    /**
     * 激活小区业务下地图的点击事件。
     * 
     * @param {boolean}
     *            mode
     */
    var setModifyPoygon = function(mode) {
        curclickpointStr = null;
        isModifyPoygon = mode;
    };
    /**
     * 地图上点击后要做的事，传出回调函数 mode：{boolean}是否地图点击起作用
     * callBack：{function}用户注册回调函数,参数为点击的经纬度
     */
    var setGetLonLat = function(mode, callBack) {
        callBackEve = callBack;
        isClickpointStr = mode;
    };
    /**
     * 激活多边形点击。
     * 
     * @param {boolean}
     *            mode
     */
    var setClickPoygon = function(mode, callbackFunc) {
        isClickyPoygon = mode;
        eventHandlerFuncs = callbackFunc;
    };

    /**
     * 小区点击。 在修改多边形情况下，获取地图上当前点击的经纬度，内部调用。
     */
    var modofyPolygonClickFunc = function(event) {
        var lonlat = mapObj.getLonLatFromPixel(event.xy);// 获取地图上鼠标点击的经纬度对象
        if (mapMgrObj.getTransformInd()) {
            mapMgrObj.reTransform(lonlat);
        }
        curclickpointStr = lonlat;
    };

    /**
     * 获取地图点击后的经纬度
     * 
     * @return {String}
     */
    var getCurclickpointStr = function() {
        isModifyPoygon = false;
        return curclickpointStr;
    };

    /**
     * 清除地图点击后的经纬度。 与getCurclickpointStr对应。
     */
    var clearCurclickpointStr = function() {
        curclickpointStr = null;
    };
    /** ****************************************多边形业务，修改多边形****************************************** */
    /**
     * 在加站模式下，点击加站
     */
    var addSiteClickFunc = function(event) {
        // 转换经纬度
        var lonlat = mapObj.getLonLatFromPixel(event.xy);
        lonlat = mapMgrObj.reTransform(lonlat);
        if (curAddSiteLayerId != null && curAddCellLayerId != null
                && addSiteInfoCallBackFunc != null) {
            // 加站模式下，先绘制基站图层
            var addSiteLayerItem = layermap.get(curAddSiteLayerId);
            var siteId = addSiteLayerItem.layerPlugObj.addNewSite(lonlat);

            // 加站模式下，再绘制小区图层
            var addCellLayerItem = layermap.get(curAddCellLayerId);
            var cellArr = addSiteInfoCallBackFunc(addSiteParam,
                    addCellLayerItem.layerParms.neId);
            addCellLayerItem.layerPlugObj.addNewCell(lonlat, cellArr, siteId);
            if (callBackFuncAfterAddSite != null
                    && typeof callBackFuncAfterAddSite == 'function') {
                callBackFuncAfterAddSite(cellArr,
                        addCellLayerItem.layerParms.netWork);
                // 保存后将基站和小区从新加列表中移出
                addSiteLayerItem.layerPlugObj.onSaveNewAddedSite(siteId);
                for ( var i = 0; i < cellArr.length; i++) {
                    addCellLayerItem.layerPlugObj
                            .onSaveNewAddedCell(cellArr[i]);
                }
            }
        }
    };

    /**
     * 判断每个图层的可见范围
     */
    var isNotInRange = function(layerItem) {
        var zoomlever = mapObj.getZoom();
        var minShowZoomLever;
        var maxShowZoomLever;
        var layerPlugObj = layerItem.layerPlugObj;
        switch (layerPlugObj.type) {
        case GisLayerType.NE:
            minShowZoomLever = mapAppParmObj.neRangStart;
            maxShowZoomLever = mapAppParmObj.neRangEnd;
            break;
        case GisLayerType.SITE:
            minShowZoomLever = mapAppParmObj.siteRangStart;
            maxShowZoomLever = mapAppParmObj.siteRangEnd;
            break;
        case GisLayerType.CELL:
            minShowZoomLever = mapAppParmObj.cellRangStart;
            maxShowZoomLever = mapAppParmObj.cellRangEnd;
            break;
        case GisLayerType.CELLCOVER:
            minShowZoomLever = mapAppParmObj.cellCoverRangStart;
            maxShowZoomLever = mapAppParmObj.cellCoverRangEnd;
            break;
        case GisLayerType.EVENT:
            minShowZoomLever = mapAppParmObj.eventRangStart;
            maxShowZoomLever = mapAppParmObj.eventRangEnd;
            break;
        case GisLayerType.GRID:
            minShowZoomLever = mapAppParmObj.gridRangStart;
            maxShowZoomLever = mapAppParmObj.gridRangEnd;
            break;
        case GisLayerType.RASTER:
            minShowZoomLever = mapAppParmObj.rasterRangStart;
            maxShowZoomLever = mapAppParmObj.rasterRangEnd;
            break;
        case GisLayerType.CUSTOMGRAPHIC:
            minShowZoomLever = mapAppParmObj.customRangStart;
            maxShowZoomLever = mapAppParmObj.customRangEnd;
            break;
        case GisLayerType.ROUNDEDGRID:
            minShowZoomLever = mapAppParmObj.roundedGridRangStart;
            maxShowZoomLever = mapAppParmObj.roundedGridRangEnd;
            break;
        default:
            return false;
        }

        if (zoomlever < minShowZoomLever || zoomlever > maxShowZoomLever) {
            layerPlugObj.refreshLayer();
            return true;
        }
        return false;
    };

    /**
     * 地图联动
     */
    var mapLinkaged = function() {
        var currLonLat = mapObj.getCenter();
        mapMgrObj.reTransform(currLonLat);
        currLonLat.lon = currLonLat.lon.toFixed(10);
        currLonLat.lat = currLonLat.lat.toFixed(10);
        for ( var i = GisObjListMgr.mapPlugObjList.get(mapPlug).size() - 1; i >= 0; i--) {
            var _mapMgr = GisObjListMgr.mapPlugObjList.get(mapPlug).vals[i];
            var lonLat = _mapMgr.getMapObject().getCenter();
            _mapMgr.reTransform(lonLat);
            lonLat.lon = lonLat.lon.toFixed(10);
            lonLat.lat = lonLat.lat.toFixed(10);
            if (!lonLat.equals(currLonLat)
                    || _mapMgr.getMapObject().getZoom() != mapObj.getZoom()) {
                if (GisMapType.MAP_BING == _mapMgr.getCurmaptype()
                        && GisMapType.MAP_BING != mapMgrObj.getCurmaptype()) {
                    if (_mapMgr.getTransformInd()) {
                        var localLonlat = new OpenLayers.LonLat(currLonLat.lon,
                                currLonLat.lat);
                        _mapMgr.transform(localLonlat);
                        _mapMgr.getMapObject().setCenter(localLonlat,
                                mapObj.getZoom() - 1);
                    } else {
                        _mapMgr.getMapObject().setCenter(currLonLat,
                                mapObj.getZoom() - 1);
                    }
                } else if (GisMapType.MAP_BING != _mapMgr.getCurmaptype()
                        && GisMapType.MAP_BING == mapMgrObj.getCurmaptype()) {
                    if (_mapMgr.getTransformInd()) {
                        var localLonlat = new OpenLayers.LonLat(currLonLat.lon,
                                currLonLat.lat);
                        _mapMgr.transform(localLonlat);
                        _mapMgr.getMapObject().setCenter(localLonlat,
                                mapObj.getZoom() + 1);
                    } else {
                        _mapMgr.getMapObject().setCenter(currLonLat,
                                mapObj.getZoom() + 1);
                    }
                } else {
                    if (_mapMgr.getTransformInd()) {
                        var localLonlat = new OpenLayers.LonLat(currLonLat.lon,
                                currLonLat.lat);
                        _mapMgr.transform(localLonlat);
                        _mapMgr.getMapObject().setCenter(localLonlat,
                                mapObj.getZoom());
                    } else {
                        _mapMgr.getMapObject().setCenter(currLonLat,
                                mapObj.getZoom());
                    }
                }
            }
        }
    };

    var setRefeshingInd = function(refreshInd) {
        refreshingInd = refreshInd;
    };

    // 外部函数 发起刷新图层主要是设置参数
    // 栅格用这个方法，需要CBB在缓存中取数据
    var setRefreshLayerParam = function(layerType, layerId, param) {
        gridClick = false;
        if (cbbBusinessMgr != null) {
            cbbBusinessMgr.initialize(this, layerType, layerId, param);
            this.refreshDataByLayer(layerId);
        }
    };
    // 外部条件变更,触发刷新图层数据(采用回调方式是在外部不需要取sequence)
    // 小区、基站等使用这个方法，不需要CBB在缓存中取数据
    var refreshDataByLayer = function(layerId) {
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            if (isNotInRange(layerItem)) {
                return;
            }
            var dataExtents = getDataExtent();
            refreshLayerDataExtent(layerItem, dataExtents);
        }
    };

    // 判断地图可见区域是否超过数据缓存的区域时刷新图层
    var refreshLayerDataExtent = function(layerItem, dataExtents) {
        if (layerItem.visibleInd) {
            var callBackFun = layerItem.refreshDataCallBackFunc;
            if (typeof callBackFun == 'function') {
                var seqVal = layerItem.seqObj.getNextVal();
                if (seqVal != 0) {
                    var layerId = layerItem.layerId;
                    var parms = {
                        layerId : layerId,
                        dataExtents : dataExtents,
                        seqVal : seqVal,
                        extParms : layerItem.layerParms,
                        gridClick : gridClick
                    };
                    callBackFun(parms);// 重新调用*Data.js请求数据，并设置业务数据给指定图层
                }
            }
        }
    };

    // 判断是否地图可见区域是否超过数据缓存的区域
    var isOutSideDataExtent = function() {
        var isOutSide = true;
        var curZoomLever = mapObj.getZoom();
        if (curZoomLever != zoomLevel) {
            isOutSide = true;
        } else {
            var curMapExtent = mapObj.getExtent();
            if (dataMapExtent != null) {
                if (dataMapExtent.containsBounds(curMapExtent)) {
                    isOutSide = false;
                }
            }
        }
        return isOutSide;
    };

    // 取当前数据缓存的区域,数据缓存的区域是可见区域的外扩0.5倍,显示区域不能跨东西经 180的分界线
    var getDataExtent = function() {
        var curMapExtent = mapObj.getExtent();
        var refreshInd = true;
        if (dataMapExtent != null) {
            if (dataMapExtent.containsBounds(curMapExtent)) {
                refreshInd = false;
            }
        }

        var currZoom = mapObj.getZoom();
        // left, bottom, right, top
        var axisVals = curMapExtent.toArray();
        var x1 = axisVals[0];
        var y1 = axisVals[1];
        var x2 = axisVals[2];
        var y2 = axisVals[3];

        var xSpan = (x2 - x1) / 2;
        var ySpan = (y2 - y1) / 2;

        var newX1 = x1 - xSpan;
        var newY1 = y1 - ySpan;
        var newX2 = x2 + xSpan;
        var newY2 = y2 + ySpan;

        axisVals[0] = newX1;
        axisVals[1] = newY1;
        axisVals[2] = newX2;
        axisVals[3] = newY2;
        var newDataMapExtent = new OpenLayers.Bounds(axisVals);

        if (refreshInd) {
            dataMapExtent = newDataMapExtent;
            zoomLevel = currZoom;
        }
        // 如果上一次的Data Extent大于当前Extent的计算范围,则使用计算范围
        else if (dataMapExtent.containsBounds(newDataMapExtent)) {
            dataMapExtent = newDataMapExtent;
            zoomLevel = currZoom;
        }
        var sourceArray = dataMapExtent.toArray();
        var destBound = new OpenLayers.Bounds(sourceArray);
        if (mapMgrObj.getTransformInd()) {
            mapMgrObj.reTransform(destBound);
        }
        var extentObj = {
            minLon : destBound.left.toFixed(3),
            maxLon : destBound.right.toFixed(3),
            minLat : destBound.bottom.toFixed(3),
            maxLat : destBound.top.toFixed(3),
            level : currZoom
        };
        return extentObj;
    };

    // 删除map上的所有popup对象，防止feature已经删除但popup对象遗留
    /*
     * 参数分别是 N/A
     */
    var removeAllPopup = function() {
        /** ******************关闭弹出框时，清除高亮的区域对象**************************** */
        if (issupportlinestringclick) {
            if (!polygonLineLayerList.isEmpty()) {
                for ( var i = 0; i < polygonLineLayerList.size(); i++) {
                    var polygonLineLayer = polygonLineLayerList.vals[i];
                    polygonLineLayer.styleMap = defaultStyleMap;
                    polygonLineLayer.redraw();
                }
            }
        } else {
            if (!polygonLayerList.isEmpty()) {
                if (GisUtils.isvalidString(highlightPolygonName)) {
                    var polygonLayer = polygonLayerList.get(highlightPolygonName);
                    if (null != polygonLayer && undefined != polygonLayer) {
                        polygonLayer.styleMap = polygonStyleMap;
                        polygonLayer.redraw();
                    }
                }
            }
        }
        /** ******************关闭弹出框时，清除高亮的区域对象**************************** */

        if (!mapObj || !mapObj.popups) {
            return;
        }
        var len = mapObj.popups.length;
        for ( var i = len - 1; i >= 0; i--) {
            var isMeasurePopup = mapObj.popups[i].isMeasurePopup;
            if (typeof isMeasurePopup != 'undefined' && isMeasurePopup) {
                var measurePopup = mapObj.popups[i];
                var id = measurePopup.ids;
                var lon = measurePopup.lon;
                var lat = measurePopup.lat;
                var contentHTML = measurePopup.contentHTML;
                var width = measurePopup.width;
                var height = measurePopup.height;
                var lastMeasurePoint = measurePopup.lastMeasurePoint;
                var popupStyle = measurePopup.popupStyle;
                var zIndex = measurePopup.zIndex;
                var popupMakerDom = document.getElementById('popup_maker_'
                        + measurePopup.ids);
                popupMakerDom.parentNode.removeChild(popupMakerDom);

                mapObj.removePopup(measurePopup);
                mapMgrObj.calAddPopupByLonlat(id, lon, lat, contentHTML, width,
                        height, lastMeasurePoint, zIndex, popupStyle);
            } else {
                if (typeof isMeasurePopup != 'undefined' && !isMeasurePopup) {
                    var popupMakerDom = document.getElementById('popup_maker_'
                            + mapObj.popups[i].ids);
                    if (popupMakerDom != null) {
                        popupMakerDom.parentNode.removeChild(popupMakerDom);
                    }
                }
                mapObj.removePopup(mapObj.popups[i]);
            }
        }
    };

    /**
     * 处理当地图缩放时，tips框小三角位置发生变化问题, 解决方案：监听地图缩放结束事件
     */
    var updateAllPopupAfterZoom = function() {
        if (!mapObj || !mapObj.popups) {
            return;
        }
        var len = mapObj.popups.length;
        for ( var i = len - 1; i >= 0; i--) {
            var isMeasurePopup = mapObj.popups[i].isMeasurePopup;
            var isTitlePopup = mapObj.popups[i].isTitlePopup;
            if (typeof isMeasurePopup != 'undefined' && isMeasurePopup) {
                var measurePopup = mapObj.popups[i];
                var id = measurePopup.ids;
                if (typeof (id) == 'undefined') {
                    var measureResult = measurePopup.measurePopup;
                    var centerLonLat = measurePopup.centerLonLat;
                    mapMgrObj.popupMeasureResult(measureResult, centerLonLat);
                } else {
                    var lon = measurePopup.lon;
                    var lat = measurePopup.lat;
                    var contentHTML = measurePopup.contentHTML;
                    var width = measurePopup.width;
                    var height = measurePopup.height;
                    var popupStyle = measurePopup.popupStyle;
                    var lastMeasurePoint = measurePopup.lastMeasurePoint;
                    var zIndex = measurePopup.zIndex;
                    var popupMakerDom = document.getElementById('popup_maker_'
                            + measurePopup.ids);
                    popupMakerDom.parentNode.removeChild(popupMakerDom);
                    mapObj.removePopup(measurePopup);
                    mapMgrObj.calAddPopupByLonlat(id, lon, lat, contentHTML,
                                    width, height, lastMeasurePoint, zIndex,
                                    popupStyle);
                }
            } else if (typeof isTitlePopup != 'undefined' && isTitlePopup) {
                var titlePopup = mapObj.popups[i];
                var contentObj = titlePopup.gisContentObj;
                var opacity = titlePopup.gisOpacity;
                var popupStyle = titlePopup.gisPopupStyle;
                var sizeMode = titlePopup.gisSizeMode;
                var width = titlePopup.gisWidth;
                var height = titlePopup.gisHeight;
                var centerLonLat = titlePopup.lonlat;
                var polygonName = titlePopup.polygonName;

                addPopupWithTitle(centerLonLat, contentObj, width, height,
                        opacity, popupStyle, sizeMode, polygonName);
                if (null != resetContent && typeof (resetContent) == 'function') {
                    resetContent(); // 缩放结束后调用nastar的回调函数，重新刷新弹出框的内容信息【解决事件丢失问题】
                }
            } else {
                mapObj.removePopup(mapObj.popups[i]);
            }
        }

        if (mapObj.popups.length > 0) {
            if (issupportlinestringclick) {
                if (!polygonLineLayerList.isEmpty()) {
                    if (GisUtils.isvalidString(highlightPolygonName)) {
                        var polygonLineLayer = polygonLineLayerList.get(highlightPolygonName);
                        if (null != polygonLineLayer && undefined != polygonLineLayer) {
                            polygonLineLayer.styleMap = selectStyleMap;
                            polygonLineLayer.redraw();
                        }
                    }
                }
            } else {
                if (!polygonLayerList.isEmpty()) {
                    if (GisUtils.isvalidString(highlightPolygonName)) {
                        var polygonLayer = polygonLayerList.get(highlightPolygonName);
                        if (null != polygonLayer && undefined != polygonLayer) {
                            polygonLayer.styleMap = polygonSelectStyleMap;
                            polygonLayer.redraw();
                        }
                    }
                }
            }
        }
    };

    /**
     * 设置测量模式 参数分别是 mode:none:取消测试模式,line:测长度
     * 
     * @param mode
     *            {String} 取值【none, line】 pointPicturePath: 测距的点图片路径，绝对路径
     *            dbCallBackFuction {Function} 测距结束回调函数
     */
    var setMeasurementMode = function(mode, pointPicturePath, dbCallBackFuction) {
        var len = mapObj.popups.length;
        for ( var i = len - 1; i >= 0; i--) {
            var isMeasurePopup = mapObj.popups[i].isMeasurePopup;
            if (typeof isMeasurePopup != 'undefined' && isMeasurePopup) {
                mapObj.popups[i].isMeasurePopup = false;
            }
        }
        removeAllPopup();
        if (mode == 'line') {
            // RUANQ 遗留， 不完善，切换鼠标样式
            document.getElementById(mapDivId_).style.cursor = 'url("/GisServer/openlayer/theme/default/img/ruler.cur"), default';
        }
        mapMgrObj.setMeasurementMode(mode, pointPicturePath, dbCallBackFuction);
    };

    /**
     * 设置多边形控件.
     * 
     * @param {boolean}
     *            mode; true : 激活多边形绘制控件、false : 关闭多边形绘制控件
     * @param {Function}
     *            callbackFun 用户注册回调函数,参数为多边形顶点字符串
     */
    var setPolygonControlMode = function(mode, callbackFun) {
        // RUANQ 切换鼠标样式
        if (mode == true) {
            document.getElementById(mapDivId_).style.cursor = 'crosshair';
        }
        mapMgrObj.setPolygonControlMode(mode, callbackFun);
    };

    /**
     * 设置矩形控件.
     * 
     * @param {boolean}
     *            mode; true : 激活矩形控件、false : 关闭矩形控件
     */
    var setBoxControlMode = function(mode, numberOfEdges) {
        // RUANQ 切换鼠标样式
        if (mode == true) {
            document.getElementById(mapDivId_).style.cursor = 'crosshair';
        }
        mapMgrObj.setBoxControlMode(mode, numberOfEdges);
    };

    /**
     * 停止绘制所有图形（包括多边形和三角形矩形圆形）
     */
    var stopDraw = function() {
        mapMgrObj.stopDraw();
    };

    /**
     * 清除所有图形
     */
    var clearDraw = function() {
        mapMgrObj.clearDraw();
    };

    /**
     * 激活线绘制控件。
     * 
     * @param mode
     *            {boolean}
     * @param calDistanceCallback
     *            {Function} 回调函数
     */
    var setLineControlMode = function(mode, calDistanceCallback) {
        mapMgrObj.setLineControlMode(mode, calDistanceCallback);
    };

    /**
     * 线绘制激活 2014-3-5 wwx174687
     */
    var setLineActivities = function(mode, layerParam) {
        mapMgrObj.setLineActivities(mode, layerParam);
    };

    /**
     * 返回区域过滤的所有点集合
     */
    var getPolygonControlPointStr = function() {
        return mapMgrObj.getPolygonControlPointStr();
    };

    /**
     * 获取多边形修改后的最新顶点。
     * 
     * @return {Array(String)}
     */
    var getLineControlPointStr = function() {
        return mapMgrObj.getLineControlPointStr();
    };

    /**
     * 使地图按给定的Bounds经纬度范围显示
     * 
     * @author m00212054
     * @param {Array}
     *            arrayBounds like [west,south,east,north]即左,下,右,上的经纬度数组
     * @param {Boolean}
     *            useClosestLevel
     *            default:false;推荐使用默认值；如果设置为true，会设置到最近的缩放级别，可能存在显示不完整（级别偏大）
     */
    var setMapExtent = function(arrayBounds, useClosestLevel) {
        if (useClosestLevel == 'undefined' || useClosestLevel == null) {
            useClosestLevel = false;
        }
        var bounds = new OpenLayers.Bounds();
        bounds.extend(new OpenLayers.LonLat(arrayBounds[0], arrayBounds[1]));
        bounds.extend(new OpenLayers.LonLat(arrayBounds[2], arrayBounds[3]));
        bounds.toBBOX(); //
        if (mapMgrObj.getTransformInd()) {
            mapMgrObj.transform(bounds);
        }
        mapObj.zoomToExtent(bounds, useClosestLevel);
    };

    // 调整Map的中心点和层级
    /*
     * 参数分别是 centerLongitude,centerLatitude:定位中心到地图目标经纬度坐标
     * zoomLeverRevise：放大或缩小地图层级 =0表示不变，>0放大，<0表示缩小，函数自动会校正放大或缩小后的无效层级
     */
    var setMapCenter = function(centerLongitude, centerLatitude, zoomLevel) {
        var centerpoint = new OpenLayers.LonLat(centerLongitude, centerLatitude);
        if (mapMgrObj.getTransformInd()) {
            mapMgrObj.transform(centerpoint);
        }
        if (zoomLevel) {
            var maxzoomLevel = mapObj.numZoomLevels;
            if (zoomLevel < 0) {
                zoomLevel = 0;
            } else if (zoomLevel > maxzoomLevel) {
                zoomLevel = maxzoomLevel;
            }
            mapObj.setCenter(centerpoint, zoomLevel);
        } else {
            mapObj.panTo(centerpoint);
        }
    };

    // 只有PRS调用，历史遗留接口，不对外暴露
    // 调整Map的中心点，并设置一个默认的zoom lever
    /*
     * 参数分别是 centerLongitude,centerLatitude定位中心到地图目标经纬度坐标
     * zoomlever的逻辑是为maxzoomLevel-2,并且不能小于cellRangStart和小于当前zoomlever
     */
    var locateMapCenter = function(centerLongitude, centerLatitude) {
        var centerpoint = new OpenLayers.LonLat(centerLongitude, centerLatitude);
        if (mapMgrObj.getTransformInd()) {
            mapMgrObj.transform(centerpoint);
        }
        var maxzoomLevel = mapObj.numZoomLevels;
        var curzoomlever = mapObj.getZoom();
        var zoomlever = maxzoomLevel - 2;

        if (zoomlever < mapAppParmObj.cellRangStart) {
            zoomlever = mapAppParmObj.cellRangStart;
        } else if (zoomlever < curzoomlever) {
            zoomlever = curzoomlever;
        }
        // 解决初始化地图后首次定位有问题,做两次zoomlever改变来解决
        // 解决基站跳转首次定位有问题,做两次zoomlever改变来解决（TODO:需要找到原因）
        lockRefresh();
        mapObj.zoomTo(1);
        curzoomlever = 1;
        unLockRefresh();

        mapObj.setCenter(centerpoint, zoomlever);
    };

    // 删除应用图层
    /*
     * 参数分别是 layerId:操作图层名称
     */
    var removeLayer = function(layerId) {
        var result = false;
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerPlug = layerItem.layerPlugObj;
            if (GisLayerType.GRID == layerPlug.type
                    || GisLayerType.ROUNDEDGRID == layerPlug.type) {
                layerPlug.removeClickLayer();
            } else if (GisLayerType.CELL == layerPlug.type
                    && layerPlug.isMarkerLayerExist()) { // 小区marker图层跟随小区图层删除
                layerPlug.removeCellMarkerLayer();
            }
            removeAllPopup();
            var layerObj = layerItem.layerObj;
            if (layerObj != null) {
                mapObj.removeLayer(layerObj);
            }
            layermap.remove(layerId);
            refreshSingleSelectCtlLayer();

            if(GisLayerType.CELL == layerPlug.type){
                layerPlug.destroy();
            } else if (layerObj.destroy) {
                layerObj.destroy();
            }

            layerPlug = null;
            layerObj = null;

            if (layerItem.refLayerId != null) {
                if (layerItem.refLayerId instanceof Array) {
                    for ( var i = 0; i < layerItem.refLayerId.length; i++) {
                        this.removeLayer(layerItem.refLayerId[i]);
                    }
                } else {
                    this.removeLayer(layerItem.refLayerId);
                }
            }
            layerItem = null;
            result = true;
        }
        return result;
    };
    /**
     * 设置图层透明度
     */
    var setLayerOpacity = function(layerId, val) {
        var result = false;
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerObj = layerItem.layerObj;
            var layerPlug = layerItem.layerPlugObj;
            if (layerObj != null) {
                if (GisLayerType.GRID != layerPlug.type
                        && GisLayerType.CELLCOVER != layerPlug.type
                        && GisLayerType.RASTER != layerPlug.type
                        && GisLayerType.ROUNDEDGRID != layerPlug.type) {
                    mapMgrObj.getSingleSelectCtl().deactivate();
                    layerObj.setOpacity(val);// 设置当前图层的透明度
                    layerPlug.setOpacity(val);// 设置图层对象中的透明度参数的值
                    mapMgrObj.getSingleSelectCtl().activate();
                } else {
                    layerObj.setOpacity(val);// 设置当前图层的透明度
                    layerPlug.setOpacity(val);// 设置图层对象中的透明度参数的值
                }
            }
            result = true;
            // 设置关联图层，关联图层有可能是个数组
            if (layerItem.refLayerId != null) {
                if (layerItem.refLayerId instanceof Array) {
                    for ( var i = 0; i < layerItem.refLayerId.length; i++) {
                        setLayerOpacity(layerItem.refLayerId[i], val);
                    }
                } else {
                    setLayerOpacity(layerItem.refLayerId, val);
                }
            }

            // 如果存在小区图层，需要设置小区marker图层
            for ( var i = 0; i < layermap.size(); i++) {
                var cellLayerPlug = layermap.get(layermap.keys[i]).layerPlugObj;
                if (null != cellLayerPlug
                        && GisLayerType.CELL == cellLayerPlug.type
                        && cellLayerPlug.isMarkerLayerExist()) {
                    cellLayerPlug.setMarkerLayerOpacity(val);
                    break;
                }
            }
        }
        return result;
    };
    /**
     * 设置图层透明度
     */
    var getLayerOpacity = function(layerId) {
        return layermap.get(layerId).layerObj.opacity;
    };
    // 设置应用图层对应的Openlayer图层显示或隐藏
    var setLayerVisibility = function(layerId, mode) {
        var result = false;
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerObj = layerItem.layerObj;
            if (layerObj != null) {
                layerObj.setVisibility(mode);
                layerItem.visibleInd = mode;
            }

            // 小区marker图层的显示与否
            var layerPlug = layerItem.layerPlugObj;
            if (null != layerPlug && GisLayerType.CELL == layerPlug.type
                    && layerPlug.isMarkerLayerExist()) {
                layerPlug.setMarkerLayerVisibility(mode);
            }
            result = true;
            // 设置关联图层
            if (layerItem.refLayerId != null) {
                if (layerItem.refLayerId instanceof Array) {
                    for ( var i = 0; i < layerItem.refLayerId.length; i++) {
                        layerItem(layerItem.refLayerId[i], mode);
                    }
                } else {
                    layerItem(layerItem.refLayerId, mode);
                }
            }
        }
        return result;
    };
    // 移动到顶部
    var moveLayerToTop = function(layerId) {
        var layerItem = layermap.get(layerId);
        if (mapObj != null) {
            mapObj.setLayerIndex(layerItem.layerObj, mapObj.layers.length - 1);
        }
    };
    // 移动几个级别
    var moveLayerToIndex = function(layerId, index) {
        var layerItem = layermap.get(layerId);
        if (mapObj != null) {
            mapObj.raiseLayer(layerItem.layerObj, index);
        }
    };

    // 添加或修改图层数据, 该图层会自动刷新
    var setLayerdata = function(layerId, appJsonData, seqVal) {
        var result = false;
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            if (layerItem.seqObj.match(seqVal)) {
                var layerPlugObj = layerItem.layerPlugObj;
                layerPlugObj.setJsonData(appJsonData);
                refreshingInd = true;
                layerPlugObj.refreshLayer();
                refreshingInd = false;
                result = true;
            } /*
                 * else { console.log('the search result is older for sequ
                 * 
                 */
        }
        return result;
    };

    // 数据由CBB提供，在GisWork中提取，走缓存
    var addCBBAppLayer = function(layerType, layerId, layerParmObj) {
        if (typeof cbbBusinessMgr != 'undefined') {
            var callBackFunc = cbbBusinessMgr.refreshDataCallBackFunc(this,
                    layerType, layerId);// 回调gridData.js中refreshDataCallBackFunc获取数据数据
            // 创建图层
            if (layerType == GisLayerType.GRID) {
                this.addGridLayer(layerId, layerParmObj, callBackFunc);
            } else {
                this
                        .addAppLayer(layerType, layerId, layerParmObj,
                                callBackFunc);
            }
        }
    };
    // 调用图层插件,建立业务图层
    // 数据直接提供，不走缓存
    /*
     * 参数分别是 layerId:应用图层的名称,在同一个地图内要保证唯一
     */
    var addAppLayer = function(layerType, layerId, layerParmObj,
            refreshDataCallBackFunc) {
        var result = false;
        var layer = null;
        if (layermap.containsKey(layerId) == false) {
            if (layerType == GisLayerType.CELL) {
                layer = new CellLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.SITE) {
                layer = new SiteLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.NE) {
                layer = new NeLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.CELLCOVER) {
                layer = new CellCoverLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.EVENT) {
                layer = new EventLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.LINE) {
                layer = new LineLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.RASTER) {
                layer = new RasterMapServerLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.TRACEBACK) {
                layer = new TracebackLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.SITESDISTANCE) {
                layer = new SitesDistanceLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.CUSTOMGRAPHIC) {
                layer = new CustomGraphicLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.ROUNDEDGRID) {
                layer = new RoundedGridLayer(this, layerParmObj);
            } else if (layerType == GisLayerType.DOUBLELINE) {
                layer = new DoubleLineLayer(this, layerParmObj);
                // 获取连线图层Id
                modefityLinelayerId = layerId;
            } else if (layerType == GisLayerType.USERDEFINED) {
                layer = new UserDefinedLayer(this, layerParmObj);
            }

            if (layer != null) {
                var layerItem = new LayerItem(layerId, layerParmObj,
                        refreshDataCallBackFunc);
                var layerObj = layer.initLayer(layerId);// RQ diao yong
                // gridLayer 创建图层
                layerItem.layerPlugObj = layer;// *gridLayer文件对象
                layerItem.layerObj = layerObj;// 栅格图层
                layermap.put(layerId, layerItem);
                refreshSingleSelectCtlLayer();
                result = true;
            }
        }
        return result;
    };

    var registerLayerEvent = function(layerId, eventCallBackFuncs) {
        var result = false;
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerPlugObj = layerItem.layerPlugObj;
            result = layerPlugObj.registerLayerEvent(eventCallBackFuncs);
        }
        return result;
    };

    // 控制图层事件是否执行的标记
    var setEventStatus = function(layerId, mode) {
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerPlugObj = layerItem.layerPlugObj;
            layerPlugObj.setEventStatus(mode);
        }
    };
    // 销毁事件
    var disableLayerEvent = function(layerId) {
        var result = false;
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerPlugObj = layerItem.layerPlugObj;
            result = layerPlugObj.registerLayerEvent(null);
            // layerPlugObj.destroy();
        }
        return result;
    };

    // 设置关联图层，用于一起显示和隐藏
    var setRefAppLayer = function(layerId, refLayerId) {
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            layerItem.refLayerId = refLayerId;
        }
    };

    // 设置圈选放大模式.
    /**
     * mode：0-正常模式，1-为圈选放大
     */
    var setPanZoomMode = function(mode) {
        mapMgrObj.setPanZoomMode(mode);
    };

    /*
     * setZIndex = function(layerId, zIndex) { var result = false; var layer =
     * layermap.get(layerId); if (layer != null) {
     * layer.layerObj.setZIndex(zIndex); result = true; } return result; }
     */

    // 初始化单选feature控件
    var refreshSingleSelectCtlLayer = function(isSupportLineStringClick) {
        issupportlinestringclick = isSupportLineStringClick;
        var layerVector = [];
        var layerItem = null;
        for ( var i = 0; i < layermap.size(); i++) {
            layerItem = layermap.vals[i];
            if (GisLayerType.GRID != layerItem.layerPlugObj.type
                    && GisLayerType.CELLCOVER != layerItem.layerPlugObj.type
                    && GisLayerType.RASTER != layerItem.layerPlugObj.type
                    && GisLayerType.ROUNDEDGRID != layerItem.layerPlugObj.type) {
                layerVector.push(layerItem.layerObj);
            }
        }

        if (null != isSupportLineStringClick
                && undefined != isSupportLineStringClick
                && typeof isSupportLineStringClick == 'boolean') {
            if (true == isSupportLineStringClick) {
                if (layerPolygonLineVector != null
                        && layerPolygonLineVector.length > 0) {
                    for ( var i = 0; i < layerPolygonLineVector.length; i++) {
                        layerVector.push(layerPolygonLineVector[i]);
                    }
                }
            } else {
                if (layerPolygonVector != null && layerPolygonVector.length > 0) {
                    for ( var i = 0; i < layerPolygonVector.length; i++) {
                        layerVector.push(layerPolygonVector[i]);
                    }
                }
            }
        } else {
            if (layerPolygonLineVector != null
                    && layerPolygonLineVector.length > 0) {
                for ( var i = 0; i < layerPolygonLineVector.length; i++) {
                    layerVector.push(layerPolygonLineVector[i]);
                }
            }
        }

        // 初始化单项模式控件
        if (layerVector.length > 0) {
            mapMgrObj.initSingleSelectCtl(layerVector);
        }
    };

    // 取消所有feature选择
    var unselectAllFeatures = function() {
        clearAllSelectedObj();
        mapMgrObj.unselectAllFeatures();
        removeAllPopup();
        if (callbackFuctionForCustomPop != null
                && typeof (callbackFuctionForCustomPop) == 'function') {
            callbackFuctionForCustomPop();
        }
        callbackFuctionForCustomPop = null;

        // 关闭TIPS时，取消栅格高亮
        var layerPlugObj = null;
        for ( var i = 0; i < layermap.size(); i++) {
            layerPlugObj = layermap.vals[i].layerPlugObj;
            if (layerPlugObj != null
                    && (layerPlugObj.type == GisLayerType.GRID || layerPlugObj.type == GisLayerType.ROUNDEDGRID)) {
                if (typeof (layerPlugObj.getHighLightStatus == 'function')
                        && layerPlugObj.getHighLightStatus() == true
                        && typeof (layerPlugObj.cancelGridHighHight) == 'function') {
                    layerPlugObj.cancelGridHighHight();
                    layerPlugObj.setHighLightStatus(false);
                }
            }
        }
    };

    // 设置进入多选模式(创建对象组模式) ,该函数会自动取消框选放大/测距/单选feature;
    var setMultiSelectMode = function(layerId, boxStyle, boxSelectStartFunc,
            boxSelectEndFunc) {

        var layerVector = [];
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerObj = layerItem.layerObj;
            if (layerObj != null) {
                layerVector.push(layerObj);
            }
        }
        // 初始化多项模式控件
        mapMgrObj.initMultiSelectCtl(mapAppParmObj, boxStyle,
                boxSelectStartFunc, boxSelectEndFunc);
        mapMgrObj.setMultiSelectMode(mapAppParmObj, layerVector);// 关闭单项模式控件，同时激活多选模式控件
        multiSelectLayerId = layerId;
        mapAppParmObj.multiSelectMode = true;
    };

    // 判断地图是否在多选模式(创建对象组模式)
    var getMultiSelectMode = function() {
        return mapAppParmObj.multiSelectMode;
    };

    // 返回是否正在刷新地图应用图层
    var getRefeshingInd = function() {
        return refreshingInd;
    };

    // 退出多选模式(创建对象组模式)
    var cancelMultiSelectMode = function() {
        clearAllSelectedObj();
        mapMgrObj.cancelMultiSelectMode();
        multiSelectLayerId = null;
        mapAppParmObj.multiSelectMode = false;
    };

    // 进入或退出多选模式中导航模式(创建对象组模式)
    var disableMultiSelectMode = function(disableInd) {
        mapMgrObj.disableMultiSelectMode(disableInd);
    };

    // 多选模式(创建对象组模式)中删除feature选中
    var removeSelectedObj = function(selectPrjParmID) {
        var idx = -1;
        var layerItem = layermap.get(multiSelectLayerId);
        if (layerItem != null) {
            var layerPlugObj = layerItem.layerPlugObj;
            idx = layerPlugObj.removeSelectedObj(selectPrjParmID);
        }
        return idx;
    };

    // 多选模式(创建对象组模式)中添加feature选中
    var addSelectedObj = function(selectPrjParmID) {
        var idx = -1;
        var layerItem = layermap.get(multiSelectLayerId);
        if (layerItem != null) {
            var layerPlugObj = layerItem.layerPlugObj;
            idx = layerPlugObj.addSelectedObj(selectPrjParmID);
        }
        return idx;
    };

    // 刷新多选模式图层，用于在对象组上删除对象后在地图上去选
    var refreshMultiSelectLayer = function() {
        var layerItem = layermap.get(multiSelectLayerId);
        if (layerItem != null) {
            refreshingInd = true;
            var layerPlugObj = layerItem.layerPlugObj;
            layerPlugObj.refreshLayer();
            refreshingInd = false;
        }
        ;
    };

    // 点击feature弹出openlayer popup对象，是二次回调函数。
    var addPopup = function(lonlat, contentHTML, width, height, opacity,
            popupStyle) {
        removeAllPopup();
        var popup = new OpenLayers.Popup.FramedCloud('popup', lonlat, null,
                contentHTML, null, true, unselectAllFeatures, popupStyle);
        popup.minSize = new OpenLayers.Size(width, height);
        popup.closeOnMove = false;
        popup.panMapIfOutOfView = false;
        popup.autoSize = true;
        mapObj.addPopup(popup);

        var top = document.getElementById('popup_contentDiv').style.top;
        if ('round-blue' == popupStyle) {
            document.getElementById("popup_GroupDiv").parentElement.style.borderRadius = '18px';
        }
        if (top == '40px') {
            document.getElementById("popup_GroupDiv").parentElement.style.boxShadow = '28px 27px 4px -17px rgba(0, 0, 0, 0.5)';
            document.getElementById("popup_GroupDiv").style.top = '1px';
            document.getElementById("popup_GroupDiv").style.left = '1px';

            // add by 2014.03.16 处理三角区大小
            var popup_contentDiv_top = document
                    .getElementById('popup_contentDiv').style.top;
            document.getElementById('popup_contentDiv').style.top = (parseInt(popup_contentDiv_top) - 23)
                    + 'px';
            var popup_close_top = document.getElementById('popup_close').style.top;
            var popup_close_right = document.getElementById('popup_close').style.right;
            document.getElementById('popup_close').style.top = (parseInt(popup_close_top) - 23)
                    + 'px';
            document.getElementById('popup_close').style.right = (parseInt(popup_close_right) + 5)
                    + 'px';

            // test code
            document.getElementById('popup_close').setAttribute("name", "GSM");

            var popup_FrameDecorationDiv_0_top = document
                    .getElementById('popup_FrameDecorationDiv_0').style.top;
            var popup_FrameDecorationDiv_1_top = document
                    .getElementById('popup_FrameDecorationDiv_1').style.top;
            var popup_FrameDecorationDiv_2_bottom = document
                    .getElementById('popup_FrameDecorationDiv_2').style.bottom;
            var popup_FrameDecorationDiv_3_bottom = document
                    .getElementById('popup_FrameDecorationDiv_3').style.bottom;
            var popup_FrameDecorationDiv_4_top = document
                    .getElementById('popup_FrameDecorationDiv_4').style.top;
            var popup_GroupDiv_top = document.getElementById('popup_GroupDiv').style.top;
            var popup_height = document.getElementById('popup').style.height;
            document.getElementById('popup_FrameDecorationDiv_0').style.top = (parseInt(popup_FrameDecorationDiv_0_top) - 19)
                    + 'px';
            document.getElementById('popup_FrameDecorationDiv_1').style.top = (parseInt(popup_FrameDecorationDiv_1_top) - 19)
                    + 'px';
            document.getElementById('popup_FrameDecorationDiv_2').style.bottom = (parseInt(popup_FrameDecorationDiv_2_bottom) - 0)
                    + 'px';
            document.getElementById('popup_FrameDecorationDiv_3').style.bottom = (parseInt(popup_FrameDecorationDiv_3_bottom) - 0)
                    + 'px';
            document.getElementById('popup_FrameDecorationDiv_4').style.top = (parseInt(popup_FrameDecorationDiv_4_top) + 3)
                    + 'px';
            document.getElementById('popup_GroupDiv').style.top = (parseInt(popup_GroupDiv_top) - 0)
                    + 'px';
            document.getElementById('popup').style.height = (parseInt(popup_height) - 19)
                    + 'px';
            // add by 2014.03.16 处理三角区大小
        } else if (top == '9px') {
            document.getElementById("popup_GroupDiv").parentElement.style.boxShadow = '23px -23px 6px -18px rgba(0, 0, 0, 0.5)';
            document.getElementById("popup_GroupDiv").style.top = '-1px';
            document.getElementById("popup_GroupDiv").style.left = '2px';

            // add by 2014.03.16 处理三角区大小
            var popup_contentDiv_top = document
                    .getElementById('popup_contentDiv').style.top;
            document.getElementById('popup_contentDiv').style.top = (parseInt(popup_contentDiv_top) - 6)
                    + 'px';
            var popup_close_top = document.getElementById('popup_close').style.top;
            var popup_close_right = document.getElementById('popup_close').style.right;
            document.getElementById('popup_close').style.top = 3 + 'px';
            document.getElementById('popup_close').style.right = (parseInt(popup_close_right) + 5)
                    + 'px';
            var popup_FrameDecorationDiv_0_top = document
                    .getElementById('popup_FrameDecorationDiv_0').style.top;
            var popup_FrameDecorationDiv_1_top = document
                    .getElementById('popup_FrameDecorationDiv_1').style.top;
            var popup_FrameDecorationDiv_2_bottom = document
                    .getElementById('popup_FrameDecorationDiv_2').style.bottom;
            var popup_FrameDecorationDiv_3_bottom = document
                    .getElementById('popup_FrameDecorationDiv_3').style.bottom;
            var popup_GroupDiv_height = document
                    .getElementById('popup_GroupDiv').style.height;
            var popup_GroupDiv_top = document.getElementById('popup_GroupDiv').style.top;
            var popup_height = document.getElementById('popup').style.height;
            var popup_top = document.getElementById('popup').style.top;
            var popup_FrameDecorationDiv_4_height = document
                    .getElementById('popup_FrameDecorationDiv_4').style.height;
            var popup_FrameDecorationDiv_4_bottom = document
                    .getElementById('popup_FrameDecorationDiv_4').style.bottom;

            document.getElementById('popup_FrameDecorationDiv_0').style.top = (parseInt(popup_FrameDecorationDiv_0_top) + 0)
                    + 'px';
            document.getElementById('popup_FrameDecorationDiv_1').style.top = (parseInt(popup_FrameDecorationDiv_1_top) + 0)
                    + 'px';
            document.getElementById('popup_FrameDecorationDiv_2').style.bottom = (parseInt(popup_FrameDecorationDiv_2_bottom) - 19)
                    + 'px';
            document.getElementById('popup_FrameDecorationDiv_3').style.bottom = (parseInt(popup_FrameDecorationDiv_3_bottom) - 19)
                    + 'px';
            document.getElementById('popup_FrameDecorationDiv_4').style.height = (parseInt(popup_FrameDecorationDiv_4_height) + 30)
                    + 'px';
            document.getElementById('popup_FrameDecorationDiv_4').style.bottom = (parseInt(popup_FrameDecorationDiv_4_bottom) - 16)
                    + 'px';
            document.getElementById('popup').style.height = (parseInt(popup_height) - 25)
                    + 'px';
            document.getElementById('popup').style.top = (parseInt(popup_top) + 22)
                    + 'px';
            document.getElementById('popup_GroupDiv').style.top = (parseInt(popup_GroupDiv_top) + 1)
                    + 'px';
            document.getElementById('popup_GroupDiv').style.overflow = 'visible';
            // add by 2014.03.16 处理三角区大小
        }
        if (typeof (opacity) != 'undefined') {
            popup.setOpacity(opacity);
        } else {
            popup.setOpacity(0.8);
        }

        // RUANQ 解决多边形弹出框不能关闭问题
        var obj = document.getElementsByTagName("div");
        var zIndexArray = [];
        for ( var i = 0; i < obj.length; i++) {
            if (obj[i].className == "olLayerDiv") {
                zIndexArray.push(parseInt(obj[i].style.zIndex));
            }
        }
        var maxZindex = Math.max.apply(Math, zIndexArray);
        var popupZIndex = parseInt(document.getElementById('popup').style.zIndex);
        if (maxZindex > popupZIndex) {
            document.getElementById('popup').style.zIndex = (maxZindex + 1);
        }
        // RUANQ 解决多边形弹出框不能关闭问题

    };
    /**
     * 定制弹出框。
     * 
     * @param lonlat
     *            {OpenLayers.LonLat}
     * @param contentHTML
     *            {String} information to show in popup
     * @param width
     *            {Integer}
     * @param height
     *            {Integer}
     * @param opacity
     *            {Float}
     * @param popupStyle
     *            {String}
     * @param callbackFuction
     *            {Function}
     * @param isAutosize
     *            {Boolean} note: if Browser window size less than popup size,
     *            need to set isAutosize false, and set width and height fixed
     *            value. remove by ruanqiang 2014.05.13
     * @param {String}
     *            polygonName 多边形名称，此参数只在多边形业务时有用。
     */
    var addPopupCustom = function(lonlat, contentHTML, width, height, opacity,
                                  popupStyle, callbackFuction, isAutosize) {
        removeAllPopup();
        callbackFuctionForCustomPop = callbackFuction;

        var close = 'popup_close';
        var groupDiv = 'popup_GroupDiv';
        var contentDiv = 'popup_contentDiv';
        var div_0 = 'popup_FrameDecorationDiv_0';
        var div_1 = 'popup_FrameDecorationDiv_1';
        var div_2 = 'popup_FrameDecorationDiv_2';
        var div_3 = 'popup_FrameDecorationDiv_3';
        var div_4 = 'popup_FrameDecorationDiv_4';
        var img_4 = 'popup_FrameDecorationImg_4';


        var contentSize = new OpenLayers.Size((width - 33), (height - 27));
        var popup = new OpenLayers.Popup.FramedCloud('popup', lonlat,
            contentSize, contentHTML, null, true, unselectAllFeatures,
            popupStyle);
        popup.closeOnMove = false;
        popup.panMapIfOutOfView = false;
        popup.autoSize = false;
        if (typeof (opacity) != 'undefined') {
            popup.setOpacity(opacity);
        } else {
            popup.setOpacity(0.8);
        }
        mapObj.addPopup(popup);

        var top = GisUtils.getDom(contentDiv).style.top;
        GisUtils.getDom(contentDiv).style.left = 0 + 'px';
        var hg = parseFloat(GisUtils.getDom(contentDiv).style.height);
        if (top == '40px') {
            GisUtils.getDom(contentDiv).style.top = 33 + 'px';
            GisUtils.getDom(contentDiv).style.height = (hg + 11) + 'px';
            GisUtils.getDom(groupDiv).parentElement.style.boxShadow = '29px 29px 6px -19px rgba(0, 0, 0, 0.5)';

            // add by 2014.03.16 处理三角区大小
            var contentDiv_top = GisUtils.getDom(contentDiv).style.top;
            GisUtils.getDom(contentDiv).style.top = (parseInt(contentDiv_top) - 23) + 'px';
            var popup_close_right = GisUtils.getDom(close).style.right;
            GisUtils.getDom(close).style.right = (parseInt(popup_close_right) + 5) + 'px';

            var div_0_top = GisUtils.getDom(div_0).style.top;
            var div_1_top = GisUtils.getDom(div_1).style.top;
            var div_2_bottom = GisUtils.getDom(div_2).style.bottom;
            var div_3_bottom = GisUtils.getDom(div_3).style.bottom;
            var popup_GroupDiv_top = GisUtils.getDom(groupDiv).style.top;
            var popup_height = GisUtils.getDom('popup').style.height;
            var div_4_top = this.getElemnt(div_4).style.top;
            GisUtils.getDom(div_0).style.top = (parseInt(div_0_top) - 19) + 'px';
            GisUtils.getDom(div_1).style.top = (parseInt(div_1_top) - 25) + 'px';
            GisUtils.getDom(div_2).style.bottom = (parseInt(div_2_bottom) - 0) + 'px';
            GisUtils.getDom(div_3).style.bottom = (parseInt(div_3_bottom) - 0) + 'px';
            GisUtils.getDom(groupDiv).style.top = (parseInt(popup_GroupDiv_top) + 2) + 'px';
            GisUtils.getDom('popup').style.height = (parseInt(popup_height) - 26) + 'px';
            GisUtils.getDom(div_4).style.top = (parseInt(div_4_top) + 4) + 'px';
            GisUtils.getDom(close).style.top = 12 + 'px';
            // add by 2014.03.16 处理三角区大小
        } else if (top == '9px') {
            GisUtils.getDom(contentDiv).style.height = (hg + 12) + 'px';
            GisUtils.getDom(contentDiv).style.top = 0 + 'px';
            GisUtils.getDom(groupDiv).parentElement.style.boxShadow = '28px -28px 6px -20px rgba(0, 0, 0, 0.5)';

            // add by 2014.03.16 处理三角区大小
            var contentDiv_height = GisUtils.getDom(contentDiv).style.height;
            var contentDiv_top = GisUtils.getDom(contentDiv).style.top;
            GisUtils.getDom(contentDiv).style.height = (parseInt(contentDiv_height) + 3) + 'px';
            GisUtils.getDom(contentDiv).style.top = (parseInt(contentDiv_top) + 1) + 'px';
            var close_top = GisUtils.getDom(close).style.top;
            var close_right = GisUtils.getDom(close).style.right;
            GisUtils.getDom(close).style.top = (parseInt(close_top) + 1) + 'px';
            GisUtils.getDom(close).style.right = (parseInt(close_right) + 5) + 'px';
            var div_0_top = GisUtils.getDom(div_0).style.top;
            var div_1_top = this.getElemnt(div_1).style.top;
            var div_2_bottom = this.getElemnt(div_2).style.bottom;
            var div_3_bottom = this.getElemnt(div_3).style.bottom;
            var popup_GroupDiv_top = GisUtils.getDom(groupDiv).style.top;
            var popup_height = GisUtils.getDom('popup').style.height;
            var popup_top = GisUtils.getDom('popup').style.top;
            var div_4_height = GisUtils.getDom(div_4).style.height;
            var div_4_bottom = GisUtils.getDom(div_4).style.bottom;

            GisUtils.getDom(div_0).style.top = (parseInt(div_0_top) + 7) + 'px';
            GisUtils.getDom(div_1).style.top = (parseInt(div_1_top) + 1) + 'px';
            GisUtils.getDom(div_2).style.bottom = (parseInt(div_2_bottom) - 22) + 'px';
            GisUtils.getDom(div_3).style.bottom = (parseInt(div_3_bottom) - 22) + 'px';
            GisUtils.getDom(div_4).style.height = (parseInt(div_4_height) + 30) + 'px';
            GisUtils.getDom(div_4).style.bottom = (parseInt(div_4_bottom) - 14) + 'px';
            GisUtils.getDom('popup').style.height = (parseInt(popup_height) - 22) + 'px';
            GisUtils.getDom('popup').style.top = (parseInt(popup_top) + 17) + 'px';
            GisUtils.getDom(groupDiv).style.top = (parseInt(popup_GroupDiv_top) - 1) + 'px';
            // add by 2014.03.16 处理三角区大小
        }

        // 给弹出框添加边框
        GisUtils.getDom(contentDiv).style.width = '99.4%';
        var contentDiv_height = parseInt(GisUtils.getDom(contentDiv).style.height);
        GisUtils.getDom(contentDiv).style.height = (contentDiv_height - 2) + 'px';
        GisUtils.getDom(contentDiv).style.border = '1px solid gray';

        GisUtils.getDom(contentDiv).parentElement.style.width = '100%';
        GisUtils.getDom(contentDiv).parentElement.style.height = '100%';

        // RUANQ 解决tips框不能关闭问题，在多边形业务上
        var obj = document.getElementsByTagName("div");
        var zIndexArray = [];
        for ( var i = 0; i < obj.length; i++) {
            if (obj[i].className == "olLayerDiv") {
                zIndexArray.push(parseInt(obj[i].style.zIndex));
            }
        }
        var maxZindex = Math.max.apply(Math, zIndexArray);
        var popupZIndex = parseInt(GisUtils.getDom('popup').style.zIndex);
        if (maxZindex > popupZIndex) {
            GisUtils.getDom('popup').style.zIndex = (maxZindex + 1);
        }

        // RUANQ 处理浏览器窗口很小时，弹出框变形问题【isAutosize:false】情况生效
        if (!isAutosize) {
            GisUtils.getDom(contentDiv).style.overflow = 'visible';
        }
    };
    /**
     * 定制弹出框。
     * 
     * @param lonlat
     *           {OpenLayers.LonLat} 弹出框弹出位置经纬度
     * @param contentObj {Object} 弹出框标题和弹出框要显示的内容信息、字体大小、内容距离左边距离 
     *           contentObj ={
     *              'title': {String},
     *              'content': {String},
     *              'marginLeft':{Integer},
     *              'titleSize': {Integer},
     *              'callbackfunction' : {Function} 
     *           }
     * @param {Integer
     *            OR String} width or 'auto' 弹出框宽度
     * @param {Integer
     *            OR String} height or 'auto' 弹出框高度
     * @param {Float}
     *            opacity 弹出框透明度
     * @param {String}
     *            popupStyle 弹出框背景图名称 取值 'blue-ucd'
     * @param {String}
     *            sizeMode 0:大 1： 小 RUANQ delete by ruanqiang 2014.04.02
     * @param {String}
     *            polygonName 多边形名称，此参数只在多边形业务时有用。
     */
    var addPopupWithTitle = function(lonlat, contentObj, width, height,
                                     opacity, popupStyle, sizeMode, polygonName) {
        removeAllPopup();
        resetContent = contentObj.callbackfunction;

        var title = '';
        var content = '';
        var fontSize = 12;
        var pop = 'popup';
        var close = 'popup_close';
        var titleDiv = 'popup_titleDiv';
        var groupDiv = 'popup_GroupDiv';
        var contentDiv = 'popup_contentDiv';
        var div_0 = 'popup_FrameDecorationDiv_0';
        var div_1 = 'popup_FrameDecorationDiv_1';
        var div_2 = 'popup_FrameDecorationDiv_2';
        var div_3 = 'popup_FrameDecorationDiv_3';
        var div_4 = 'popup_FrameDecorationDiv_4';
        var img_4 = 'popup_FrameDecorationImg_4';

        if (GisUtils.isObject(contentObj)) {
            title = contentObj.title;
            content = contentObj.content;
            if (GisUtils.isNumber(contentObj.titleSize)) {
                fontSize = contentObj.titleSize;
            }
        }

        var contentSize = new OpenLayers.Size(width, height);
        var contentHTML = '<div>'+ content + '</div>';
        popup = new OpenLayers.Popup.FramedCloud(pop, lonlat, contentSize,
            contentHTML, null, true, unselectAllFeatures, popupStyle, title);

        popup.setOpacity(opacity);
        popup.closeOnMove = false;
        popup.panMapIfOutOfView = false;
        popup.autoSize = false;
        popup.isTitlePopup = true;
        popup.gisContentObj = contentObj;
        popup.gisOpacity = opacity;
        popup.gisPopupStyle = popupStyle;
        popup.gisSizeMode = sizeMode;
        popup.gisWidth = width;
        popup.gisHeight = height;
        mapObj.addPopup(popup);

        var popupWidth = GisUtils.getDom(pop).style.width;
        var top = GisUtils.getDom(contentDiv).style.top;
        var popupLeft = GisUtils.getDom(pop).style.left;
        var textContent = GisUtils.getDom(div_4).attributes[1].textContent;
        GisUtils.getDom(div_4).style.height = '37px';
        GisUtils.getDom(img_4).style.height = '738px';
        GisUtils.getDom(pop).style.width = (parseInt(popupWidth) - 31) + 'px';
        GisUtils.getDom(close).style.width = 20 + 'px';
        GisUtils.getDom(close).style.height = 20 + 'px';
        GisUtils.getDom(close).style.backgroundColor = '#208098';
        GisUtils.getDom(close).style.borderRadius = 15 + 'px';
        GisUtils.getDom(close).onmouseover = function() {
            this.style.backgroundColor = '#FFFFFF';
        };
        GisUtils.getDom(close).onmouseout = function() {
            this.style.backgroundColor = '#208098';
        };

        if (top == '40px') {
            var popup_height = GisUtils.getDom(pop).style.height;
            var popup_close_top = GisUtils.getDom(close).style.top;
            var popup_close_right = GisUtils.getDom(close).style.right;
            var popup_GroupDiv_top = GisUtils.getDom(groupDiv).style.top;
            var popup_contentDiv_top = GisUtils.getDom(contentDiv).style.top;
            var div_0_top = GisUtils.getDom(div_0).style.top;
            var div_0_height = GisUtils.getDom(div_0).style.height;
            var div_1_top = GisUtils.getDom(div_1).style.top;
            var div_1_height = GisUtils.getDom(div_1).style.height;
            var div_4_top = GisUtils.getDom(div_4).style.top;
            var div_2_bottom = GisUtils.getDom(div_2).style.bottom;
            var div_3_bottom = GisUtils.getDom(div_3).style.bottom;
            var div_4_left = GisUtils.getDom(div_4).style.left;
            var div_4_right = GisUtils.getDom(div_4).style.right;

            GisUtils.getDom(pop).style.height = (parseInt(popup_height) - 20) + 'px';
            GisUtils.getDom(close).style.top = (parseInt(popup_close_top) - 21) + 'px';
            GisUtils.getDom(titleDiv).style.top = 13 + 'px';
            GisUtils.getDom(contentDiv).style.top = (parseInt(popup_contentDiv_top) + 8) + 'px';
            GisUtils.getDom(div_0).style.top = (parseInt(div_0_top) - 19) + 'px';
            GisUtils.getDom(div_0).style.height = (parseInt(div_0_height) + 199) + 'px';
            GisUtils.getDom(div_1).style.top = (parseInt(div_1_top) - 19) + 'px';
            GisUtils.getDom(div_1).style.height = (parseInt(div_1_height) + 199) + 'px';
            GisUtils.getDom(div_2).style.bottom = (parseInt(div_2_bottom) - 1) + 'px';
            GisUtils.getDom(div_3).style.bottom = (parseInt(div_3_bottom) - 1) + 'px';
            GisUtils.getDom(div_4).style.top = (parseInt(div_4_top) - 18) + 'px';
            if (GisUtils.isvalidString(textContent)) {
                if (textContent.indexOf('right') != -1) {
                    GisUtils.getDom(div_4).style.right = (parseInt(div_4_right) - 7) + 'px';
                    GisUtils.getDom(pop).style.left = (parseInt(popupLeft) + 30) + 'px';
                } else if (textContent.indexOf('left') != -1) {
                    GisUtils.getDom(div_4).style.left = (parseInt(div_4_left) - 7) + 'px';
                }
            } else {
                if (div_4_right != "") {
                    GisUtils.getDom(div_4).style.right = (parseInt(div_4_right) - 9) + 'px';
                } else if (div_4_left != "") {
                    GisUtils.getDom(div_4).style.left = (parseInt(div_4_left) - 9) + 'px';
                }
            }

            GisUtils.getDom(pop).style.height = (height + 128) + 'px';
        } else if (top == '9px') {
            var popup_top = GisUtils.getDom(pop).style.top;
            var popup_height = GisUtils.getDom(pop).style.height;
            var popup_close_top = GisUtils.getDom(close).style.top;
            var popup_close_right = GisUtils.getDom(close).style.right;
            var popup_GroupDiv_height = GisUtils.getDom(groupDiv).style.height;
            var popup_GroupDiv_top = GisUtils.getDom(groupDiv).style.top;
            var popup_contentDiv_top = GisUtils.getDom(contentDiv).style.top;
            var div_0_top = GisUtils.getDom(div_0).style.top;
            var div_0_height = GisUtils.getDom(div_0).style.height;
            var div_1_top = GisUtils.getDom(div_1).style.top;
            var div_1_height = GisUtils.getDom(div_1).style.height;
            var div_2_bottom = GisUtils.getDom(div_2).style.bottom;
            var div_3_bottom = GisUtils.getDom(div_3).style.bottom;
            var div_4_height = GisUtils.getDom(div_4).style.height;
            var div_4_bottom = GisUtils.getDom(div_4).style.bottom;
            var div_4_left = GisUtils.getDom(div_4).style.left;
            var div_4_right = GisUtils.getDom(div_4).style.right;

            GisUtils.getDom(pop).style.height = (parseInt(popup_height) - 23) + 'px';
            GisUtils.getDom(pop).style.top = (parseInt(popup_top) - 81) + 'px';
            GisUtils.getDom(close).style.top = 9 + 'px';
            GisUtils.getDom(contentDiv).style.top = (parseInt(popup_contentDiv_top) + 26) + 'px';
            GisUtils.getDom(div_0).style.top = (parseInt(div_0_top) + 0) + 'px';
            GisUtils.getDom(div_0).style.height = (parseInt(div_0_height) +110) + 'px';
            GisUtils.getDom(div_1).style.top = (parseInt(div_1_top) + 0) + 'px';
            GisUtils.getDom(div_1).style.height = (parseInt(div_1_height) + 110) + 'px';
            GisUtils.getDom(div_2).style.bottom = (parseInt(div_2_bottom) - 22) + 'px';
            GisUtils.getDom(div_3).style.bottom = (parseInt(div_3_bottom) - 22) + 'px';
            GisUtils.getDom(div_4).style.bottom = (parseInt(div_4_bottom) - 22) + 'px';
            if (GisUtils.isvalidString(textContent)) {
                if (textContent.indexOf('right') != -1) {
                    GisUtils.getDom(div_4).style.right = (parseInt(div_4_right) - 12) + 'px';
                    GisUtils.getDom(pop).style.left = (parseInt(popupLeft) + 30) + 'px';
                } else if (textContent.indexOf('left') != -1) {
                    GisUtils.getDom(div_4).style.left = (parseInt(div_4_left) - 12) + 'px';
                }
            } else {
                if (div_4_right != "") {
                    GisUtils.getDom(div_4).style.right = (parseInt(div_4_right) - 14) + 'px';
                } else if (div_4_left != "") {
                    GisUtils.getDom(div_4).style.left = (parseInt(div_4_left) - 14) + 'px';
                }
            }
            GisUtils.getDom(pop).style.height = (height + 128) + 'px';
        }
        GisUtils.getDom(contentDiv).style.left = 1 + 'px';
        GisUtils.getDom(contentDiv).style.height = (height + 76) + 'px';


        // RUANQ 解决多边形弹出框不能关闭问题
        var obj = document.getElementsByTagName("div");
        var zIndexArray = [];
        for (var i = 0; i < obj.length; i++) {
            if (obj[i].className == "olLayerDiv") {
                zIndexArray.push(parseInt(obj[i].style.zIndex));
            }
        }
        var maxZindex = Math.max.apply(Math, zIndexArray);
        var popupZIndex = parseInt(GisUtils.getDom(pop).style.zIndex);
        if (maxZindex > popupZIndex) {
            GisUtils.getDom(pop).style.zIndex = (maxZindex + 1);
        }

        var markersDiv = document.getElementsByClassName('olLayerDiv');
        if (markersDiv.length > 0) {
            for (var i = 0; i < markersDiv.length; i++) {
                var zIndex = markersDiv[i].style.zIndex;
                GisUtils.getDom(titleDiv).style.zIndex = (parseFloat(zIndex) * 11);
            }
        }

        // 高亮多边形
        if (GisUtils.isvalidString(polygonName)) {
            popup.polygonName = polygonName;
            highlightPolygon(polygonName, polygonLineLayerList);
        }
    };

    // 根据经纬度弹tip
    var addPopupByLonlat = function(lon, lat, contentHTML, width, height,
            opacity, popupStyle, polygonName) {
        removeAllPopup();
        var centerLonLat = new OpenLayers.LonLat(lon, lat);
        mapMgrObj.transform(centerLonLat);
        var popup = new OpenLayers.Popup.FramedCloud('popup', centerLonLat,
                null, contentHTML, null, true, unselectAllFeatures, popupStyle);
        popup.minSize = new OpenLayers.Size(width, height);
        popup.closeOnMove = false;
        popup.panMapIfOutOfView = false;
        popup.autoSize = true;
        mapObj.addPopup(popup);

        /** ********************弹出框后高亮多边形******************************* */
        if (null != polygonLineLayerList && undefined != polygonLineLayerList) {
            if (polygonLineLayerList.size() > 0 && null != polygonName
                    && undefined != polygonName
                    && null != polygonLineLayerList.get(polygonName)
                    && undefined != polygonLineLayerList.get(polygonName)) {
                var polygonLineLayer = polygonLineLayerList.get(polygonName);
                polygonLineLayer.styleMap = selectStyleMap;
                polygonLineLayer.redraw();
            }
        }
        /** ********************弹出框后高亮多边形******************************* */

        if (typeof (opacity) != 'undefined') {
            popup.setOpacity(opacity);
        } else {
            popup.setOpacity(0.8);
        }

        // RUANQ 解决多边形弹出框不能关闭问题
        var obj = document.getElementsByTagName("div");
        var zIndexArray = [];
        for ( var i = 0; i < obj.length; i++) {
            if (obj[i].className == "olLayerDiv") {
                zIndexArray.push(parseInt(obj[i].style.zIndex));
            }
        }
        var maxZindex = Math.max.apply(Math, zIndexArray);
        var popupZIndex = parseInt(document.getElementById('popup').style.zIndex);
        if (maxZindex > popupZIndex) {
            document.getElementById('popup').style.zIndex = (maxZindex + 1);
        }
        // RUANQ 解决多边形弹出框不能关闭问题
    };

    // 根据经纬度弹tip(PVIS定制)
    var addImagePopupByLonlat = function(lon, lat, contentHTML, width, height,
            popupStyle) {
        var lonlat = new OpenLayers.LonLat(lon, lat);
        mapMgrObj.transform(lonlat);
        // 弹出框
        var popup = new OpenLayers.Popup.FramedCloud('popup', lonlat, null,
                contentHTML, null, true, unselectAllFeatures, popupStyle);
        // 矩形样式
        popup.minSize = new OpenLayers.Size(width, height);
        popup.closeOnMove = false;
        popup.autoSize = true;
        mapObj.addPopup(popup);

        // 去除关闭按钮
        document.getElementById('popup_close').style.display = "none";
        if (typeof (opacity) != 'undefined') {
            popup.setOpacity(opacity);
        } else {
            popup.setOpacity(0.8);
        }
    };

    // 设置单选选中的feature,在查找或图例点击并定位对象位置，会触发选中feature事件,从而选中并弹出详细信息
    /**
     * @param layerId
     *            {String} 图层名称
     * @param selectPrjParmID
     *            {Integer} 矢量元素id，数据库中唯一值
     */
    var setSelectedObj = function(layerId, selectPrjParmID, flag) {
        var result = false;
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerPlugObj = layerItem.layerPlugObj;
            layerPlugObj.setSelectedObj(selectPrjParmID, flag);
            result = true;
        }
        return result;
    };

    // 清除所有的外部选中对象
    var clearAllSelectedObj = function() {
        var layerPlugObj = null;
        for (var i = 0; i < layermap.size(); i++) {
            layerPlugObj = layermap.vals[i].layerPlugObj;
            if (layerPlugObj != null
                    && (layerPlugObj.type == GisLayerType.CELL || layerPlugObj.type == GisLayerType.SITE || layerPlugObj.type == GisLayerType.NE)) {
                layerPlugObj.clearSelectedObj();
            }
        }
    };

    // 设置显示小区或基站模式
    // 为小区和基站的关联设置的标记
    var setCellMode = function(cellModeInd) {
        mapAppParmObj.cellMode = cellModeInd;
    };

    // 临时锁定地图对象刷新，避免没有必要重复刷新导致性能降低
    var lockRefresh = function() {
        lockRefreshInd = true;
    };
    // 解除临时的地图对象刷新锁定
    var unLockRefresh = function() {
        lockRefreshInd = false;
    };

    // 取图层的sequence对象
    // 只有PRS用这个接口
    var getSeqObj = function(layerId) {
        var layerItem = layermap.get(layerId);
        var seqObj = null;
        if (layerItem != null) {
            seqObj = layerItem.seqObj;
        }
        return seqObj;
    };

    /**
     * 计算两条直线之间的夹角
     * 参数：顶点经度apexLon，顶点纬度apexLat，点1经度lon1，点1纬度lat1，点2经度lon2，点2纬度lat2
     * '{"startLon":104.16502,"startLat":30.6903,"startAngle":"270","endLon":104.16899,"endLat":30.68461,}' +
     */
    var lineAngle = function(layerId, apexLon, apexLat, azimuth, lon, lat) {
        var layerObj = layermap.get(layerId).layerPlugObj;
        var tempPoint = layerObj.getRhombusVertexCoordinate(apexLon, apexLat,
                1, azimuth, 60);
        var centerLon = tempPoint.x.toFixed(4);
        var centerLat = tempPoint.y.toFixed(4);
        var lineALength = Math.sqrt(Math.pow((lon - centerLon), 2)
                + Math.pow((lat - centerLat), 2));
        var lineBLength = Math.sqrt(Math.pow((apexLon - centerLon), 2)
                + Math.pow((apexLat - centerLat), 2));
        var lineCLength = Math.sqrt(Math.pow((apexLon - lon), 2)
                + Math.pow((apexLat - lat), 2));
        var cosA = (Math.pow(lineBLength, 2) + Math.pow(lineCLength, 2) - Math
                .pow(lineALength, 2))
                / (2 * lineBLength * lineCLength);
        var angle = Math.acos(cosA) / Math.PI * 180;
        return angle.toFixed(1);
    };

    /**
     * 三个点之间的夹角（第二个点为顶点）
     */
    var lineAngleByPoint = function(apexLon, apexLat, centerLon, centerLat,
            endLon, endLat) {
        var lineALength = Math.sqrt(Math.pow((apexLon - endLon), 2)
                + Math.pow((apexLat - endLat), 2));
        var lineBLength = Math.sqrt(Math.pow((centerLon - endLon), 2)
                + Math.pow((centerLat - endLat), 2));
        var lineCLength = Math.sqrt(Math.pow((centerLon - apexLon), 2)
                + Math.pow((centerLat - apexLat), 2));
        var cosA = (Math.pow(lineBLength, 2) + Math.pow(lineCLength, 2) - Math
                .pow(lineALength, 2))
                / (2 * lineBLength * lineCLength);
        var angle = Math.acos(cosA) / Math.PI * 180;
        return angle.toFixed(1);
    };

    /**
     * 获取地图上指定经纬度的海拔高度。
     * 
     * @param {double}
     *            lat 纬度
     * @param {double}
     *            lon 经度
     * @param {function}
     *            callbackForGetevelation 回调函数
     */
    var getElevationForGoolge = function(lat, lon, callbackForGetevelation) {
        var elevator = new google.maps.ElevationService();
        var locations = [];
        var clickedLocation = new google.maps.LatLng(lat, lon);// note argument
        // odering for
        // lat and lon
        locations.push(clickedLocation);
        var positionalRequest = {
            'locations' : locations
        };
        elevator.getElevationForLocations(positionalRequest, function(results,
                status) {
            if (status == google.maps.ElevationStatus.OK) {
                if (results[0]) {
                    var lonlat = new OpenLayers.LonLat(lon, lat);
                    if (mapMgrObj.getTransformInd()) {
                        mapMgrObj.transform(lonlat);
                    }
                    var evelation = results[0].elevation;
                    callbackForGetevelation(lonlat, evelation);
                }
            } else {
                alert("Elevation service failed due to: " + status);
            }
        });
    };

    /**
     * 地图四等分之后需要更新地图对象的大小
     */
    var updateMapDivSize = function() {
        mapObj.updateSize();
    };

    /**
     * 创建图层，并在图层上添加元素。
     * 
     * @param layerid
     *            {String} a id for layer
     * @param polygonVertices
     *            {String} 多边形顶点经纬度列表字符串。
     */
    var createLayerForObjGroup = function(layerid, polygonVertices) {
        var options = {
            styleMap : new OpenLayers.StyleMap({
                'default' : new OpenLayers.Style({
                    fillOpacity : 0.4,// RQ 圈选图形填充透明度
                    fillColor : '#FFFFFF',// RQ 圈选图形填充颜色
                    strokeColor : "#FFFFFF",
                    strokeOpacity : 1.0,
                    strokeWidth : 2,
                    pointRadius : 1,
                    strokeDashstyle : "solid"
                })
            }),
            displayInLayerSwitcher : false
        };
        var layerold = zoneLayerList.get(layerid);
        if (layerold == null) {
            var layer = new OpenLayers.Layer.Vector(layerid, options);
            zoneLayerList.put(layerid, layer);
        }
        layerold = zoneLayerList.get(layerid);
        var lonlats = [];
        if (null != polygonVertices) {
            lonlats = polygonVertices.split(";");
        }
        var length = lonlats.length - 1;
        var vectorList = [];
        var pointList = [];
        if (lonlats != null && length > 0) {
            for ( var i = 0; i < length; i++) {
                var lonlat = lonlats[i];
                var lonlatArray = lonlat.split(",");
                var lon = parseFloat(lonlatArray[0]);
                var lat = parseFloat(lonlatArray[1]);
                var location = new OpenLayers.Geometry.Point(lon, lat);
                mapMgrObj.transform(location);
                pointList.push(location);
            }
        }
        var ring = new OpenLayers.Geometry.LinearRing(pointList);
        var polygon = new OpenLayers.Geometry.Polygon([ring]);
        var feature = new OpenLayers.Feature.Vector(polygon);
        vectorList.push(feature);
        layerold.removeAllFeatures();
        if (null == polygonVertices) {
            layerold.removeAllFeatures({
                silent : true
            });
            mapObj.removeLayer(layerold);
        } else {
            layerold.addFeatures(vectorList);
            mapObj.addLayer(layerold);
        }
        layerold.setZIndex(500);
    };

    /**
     * 删除zone组创建的图层。
     */
    var romoveLayerForZone = function(layerid) {
        if (zoneLayerList.size() > 0) {
            var layer = zoneLayerList.get(layerid);
            if (null != layer && "" != layer && "Undefined" != layer) {
                layer.removeAllFeatures({
                    silent : true
                });
                removeZoneLayerList(layerid);
                mapObj.removeLayer(layer);
            }
        }
    };

    /**
     * 删除所有zone图层
     * 
     * @param {}
     *            layerid
     */
    var romoveAllLayerForZone = function() {
        if (zoneLayerList.size() > 0) {
            var len = zoneLayerList.size();
            for ( var i = len - 1; i >= 0; i--) {
                var _key = zoneLayerList.keys[i];
                var _layer = zoneLayerList.vals[i];
                if (null != _layer && "" != _layer && "undefined" != _layer) {
                    _layer.removeAllFeatures({
                        silent : true
                    });
                    removeZoneLayerList(_key);
                    mapObj.removeLayer(_layer);
                }
            }
        }
    };

    /**
     * 高亮指定名称多边形。
     * 
     * @param polygonname
     *            {String} 多边形名称
     * @param polygonLineLayerList
     *            {GISHashMap} 多边形边线图层列表
     */
    function highlightPolygon(polygonname, polygonLineLayerList) {
        highlightPolygonName = null;
        if (!polygonLineLayerList.isEmpty()) {
            if (GisUtils.isvalidString(polygonname)) {
                var polygonLineLayer = polygonLineLayerList.get(polygonname);
                polygonLineLayer.styleMap = selectStyleMap;
                polygonLineLayer.redraw();
            }
            highlightPolygonName = polygonname;
        }
    };

    /**
     * 
     * 描述：绘制多边形。
     * 
     * @param polygonProperty
     *            {Object} 多边形属性
     * 
     * polygonProperty = { polygonName：{String}, 多边形名称 polygonVertices：{String},
     * 多边形顶点 fillColor: {String}, 多边形填充颜色 callbackFun: {Function},
     * 带参回调函数，仅一个参数，参数类型Object importantWarning: { 严重警告 value: {String},
     * fontSize: {Integer}, fontColor:{String}, unitCss:{String},
     * unitSelectCss:{String} }, backslash: { 反斜杠 value: {String}, fontSize:
     * {Integer}, fontColor:{String}, unitCss:{String}, unitSelectCss:{String} },
     * totalWarning: { 警告数量 value: {String}, fontSize: {Integer},
     * fontColor:{String}, unitCss:{String}, unitSelectCss:{String} }, unit: {
     * 单位 value: {String}, fontSize: {Integer}, fontColor:{String},
     * unitCss:{String}, unitSelectCss:{String} }, lineProperties: {
     * strokeColor: {String}, strokeOpacity: {Float}, strokeWidth: {Integer},
     * strokeColorCLK: {String}, strokeWidthCLK: {Integer} }, fillOpcity:
     * {Float} 多边形填充透明度 isEditMode: {Boolean}, 多边形是否在编辑状况 polygonNameLength:
     * {Integer}, 设定要显示多边形名称的长度【超过此长度，多边形将以省略号方式处理】 visibleLevel: {
     * polygonVisibleLevel:{Integer} 多边形及多边形边框的可是级别，取值范围 【0,18】
     * markerVisibleLevel:{Integer} 多边形marker的可以级别，取值范围 【0,18】 }, isShowTips:
     * {Boolean}, 是否支持鼠标悬浮框 isSupportLineStringClick: {Boolean} true:
     * 支持多边形和多边形内部元素点击，false：仅支持多边形内部点击
     *  }
     * @returns {boolean}
     */
    var drawPolygon = function(polygonProperty) {
        var polygonName = polygonProperty.polygonName;
        var polygonVertices = polygonProperty.polygonVertices;
        var fillColor = polygonProperty.fillColor;
        var callbackFun = polygonProperty.callbackFun;
        var importantWarning = polygonProperty.importantWarning;
        var backslash = polygonProperty.backslash;
        var totalWarning = polygonProperty.totalWarning;
        var unit = polygonProperty.unit;
        var lineProperties = polygonProperty.lineProperties;
        var fillOpcity = polygonProperty.fillOpcity;
        var isEditMode = polygonProperty.isEditMode;
        var polygonNameLength = polygonProperty.polygonNameLength;
        var visibleLevel = polygonProperty.visibleLevel;
        var isShowTips = polygonProperty.isShowTips;
        var isSupportLineStringClick = polygonProperty.isSupportLineStringClick;
        if (!GisUtils.isvalidString(polygonName)) {
            return;
        }
        var uuid_value = getUUidValue(16,10);
        if (visibleLevel.polygonVisibleLevel != null && typeof(visibleLevel.polygonVisibleLevel) == 'number' &&
                visibleLevel.polygonVisibleLevel > 0) {
            polygonVisibleLevel = visibleLevel.polygonVisibleLevel;
        }
        if (visibleLevel.markerVisibleLevel != null && typeof(visibleLevel.markerVisibleLevel) == 'number' &&
                visibleLevel.markerVisibleLevel > 0) {
            markerVisibleLevel = visibleLevel.markerVisibleLevel;
        }
        var importantWarningCss = 'font-weight:bold;';
        var backslashCss = 'font-weight:bold;';
        var totalWarningCss = 'font-weight:bold;';
        var unitCss = 'font-weight:bold;';
        var nameCss = 'color:#3BB2DA;font-weight: bold;font-size:14px;';
        var strokeColor = 'white';
        var strokeOpacity = 0.6;
        var strokeWidth = 5;
        var strokeColorCLK = 'black';
        var strokeWidthCLK = 5;
        if (lineProperties != null) {
            if (lineProperties.strokeColor != null && '' != lineProperties.strokeColor) {
                strokeColor = lineProperties.strokeColor;
            } else {
                strokeColor = 'white';
            }
            if (lineProperties.strokeOpacity != null && '' != lineProperties.strokeOpacity) {
                strokeOpacity = lineProperties.strokeOpacity;
            } else {
                strokeOpacity = 0.6;
            }
            if (lineProperties.strokeWidth != null && '' != lineProperties.strokeWidth) {
                strokeWidth = lineProperties.strokeWidth;
            } else {
                strokeWidth = 5;
            }
            if (lineProperties.strokeColorCLK != null && '' != lineProperties.strokeColorCLK) {
                strokeColorCLK = lineProperties.strokeColorCLK ;
            } else {
                strokeColorCLK = 'black';
            }
            if (lineProperties.strokeWidthCLK != null && '' != lineProperties.strokeWidthCLK) {
                strokeWidthCLK = lineProperties.strokeWidthCLK ;
            } else {
                strokeWidthCLK = 5;
            }
        }
        var interval = null;
        var lonlats = [];
        if(null != polygonVertices){
            lonlats = polygonVertices.split(";");
        }
        var length = lonlats.length-1;
        var polygonLineOptions = null;
        var selectStyleMapForEdit = new OpenLayers.StyleMap({
            'default' : new OpenLayers.Style({
                strokeColor : strokeColorCLK,
                strokeOpacity : 1,
                strokeWidth : strokeWidthCLK,
                strokeDashstyle: 'dash'
            }),
            'temporary' : new OpenLayers.Style({
                strokeColor : strokeColorCLK,
                cursor: 'pointer'
            }),
            'select' : new OpenLayers.Style({
                strokeColor : strokeColorCLK,
                cursor: 'pointer'
            })
        });
        var defaultStyleMapForEdit = new OpenLayers.StyleMap({
            'default' : new OpenLayers.Style({
                strokeColor : strokeColor,
                strokeOpacity : strokeOpacity,
                strokeWidth: strokeWidth,
                strokeDashstyle: 'dash'
            }),
            'temporary' : new OpenLayers.Style({
                strokeColor : strokeColor,
                cursor: 'pointer'
            }),
            'select' : new OpenLayers.Style({
                strokeColor : strokeColor,
                cursor: 'pointer'
            })
        });
        selectStyleMap = new OpenLayers.StyleMap({
            'default' : new OpenLayers.Style({
                strokeColor : strokeColorCLK,
                strokeOpacity : 1,
                strokeWidth: strokeWidthCLK,
                strokeDashstyle: 'solid'
            }),
            'temporary' : new OpenLayers.Style({
                strokeColor : strokeColorCLK,
                cursor: 'pointer'
            }),
            'select' : new OpenLayers.Style({
                strokeColor : strokeColorCLK
            })
        });
        defaultStyleMap = new OpenLayers.StyleMap({
            'default' : new OpenLayers.Style({
                strokeColor : strokeColor,
                strokeOpacity : strokeOpacity,
                strokeWidth: strokeWidth,
                strokeDashstyle: 'solid',
                cursor: 'pointer'
            }),
            'temporary' : new OpenLayers.Style({
                strokeColor : strokeColor,
                cursor: 'pointer'
            }),
            'select' : new OpenLayers.Style({
                strokeColor : strokeColor,
                cursor: 'pointer'
            })
        });
        if (isEditMode) {
            polygonLineOptions = { // RUANQ 多边形边线颜色
                styleMap : defaultStyleMapForEdit,
                displayInLayerSwitcher : false
            };
        } else {
            polygonLineOptions = { // RUANQ 多边形边线样式
                styleMap : defaultStyleMap,
                eventListeners : {
                    'featureselected' : function(evt) {
                        if (GisUtils.isvalidString(importantWarning.importantWarningSelectCss)) {
                            GisUtils.getDom('importantWarning' + uuid_value).style.cssText = importantWarning.importantWarningSelectCss;
                        }
                        if (GisUtils.isvalidString(backslash.backslashSelectCss)) {
                            GisUtils.getDom('backslash' + uuid_value).style.cssText = backslash.backslashSelectCss;
                        }
                        if (GisUtils.isvalidString(totalWarning.totalWarningSelectCss)) {
                            GisUtils.getDom('totalWarning' + uuid_value).style.cssText = totalWarning.totalWarningSelectCss;
                        }
                        if (GisUtils.isvalidString(unit.unitSelectCs)) {
                            GisUtils.getDom('unit' + uuid_value).style.cssText = unit.unitSelectCss;
                        }
                        if (GisUtils.isvalidString(unit.nameSelectCss)) {
                            GisUtils.getDom('polygonName' + uuid_value).style.cssText = unit.nameSelectCss;
                        }
                        var feature = evt.feature;
                        var startPoint = feature.attributes.startPoint;
                        var endPoint = feature.attributes.endPoint;
                        var commObj = {
                            commpolygonNames : new Array(),
                            commcenterLonlats : new Array(),
                            commVertiesList : new Array()
                        };
                        for ( var i = 0, len = polygonLayerList.size(); i < len; i++) { // 所有的多边形图层
                            var verticesForPly = polygonLayerList.vals[i].features[0].geometry.getVertices();
                            var xCoordinates = [];
                            var yCoordinates = [];
                            for ( var v = 0; v < verticesForPly.length; v++) {
                                xCoordinates.push(verticesForPly[v].x);
                                yCoordinates.push(verticesForPly[v].y);
                            }
                            if (OpenLayers.Util.indexOf(xCoordinates, startPoint.x) != -1
                                && OpenLayers.Util.indexOf(yCoordinates, startPoint.y) != -1
                                && OpenLayers.Util.indexOf(xCoordinates, endPoint.x) != -1
                                && OpenLayers.Util.indexOf(yCoordinates, endPoint.y) != -1) {

                                var polygonname = polygonLayerList.keys[i];
                                var feature = polygonLayerList.get(polygonname).features[0];
                                var polygonCenterLonLat = feature.geometry.getBounds().getCenterLonLat();
                                var polygonVerties = polygonVertiesList.get(polygonname);
                                commObj.commpolygonNames.push(polygonname);
                                commObj.commcenterLonlats.push(polygonCenterLonLat);
                                commObj.commVertiesList.push(polygonVerties);
                            }
                        }

                        var OverlappingPolygonLen = commObj.commpolygonNames.length;
                        if (1 == OverlappingPolygonLen) {
                            removeAllPopup();
                            var polygonname = commObj.commpolygonNames[0]
                            callbackFun({
                                polygonName : polygonname,
                                polygonCenterLonLat : commObj.commcenterLonlats[0],
                                polygonVerties : commObj.commVertiesList[0]
                            });

                            highlightPolygon(polygonname, polygonLineLayerList);
                        } else if (OverlappingPolygonLen > 1) {
                            var lineCenterCoordinate = {
                                lon : (startPoint.x + endPoint.x) / 2,
                                lat : (startPoint.y + endPoint.y) / 2
                            }
                            var html = '<div id="overlapping_polygon_list"><ul>';
                            for ( var i = 0; i < OverlappingPolygonLen; i++) {
                                var lon = commObj.commcenterLonlats[i].lon;
                                var lat = commObj.commcenterLonlats[i].lat;
                                var name = commObj.commpolygonNames[i];
                                var verites = commObj.commVertiesList[i];
                                if (i%2 == 1) {
                                    if (name.length > 15) {
                                        html = html + '<li lon = ' + lon + ' lat = ' + lat + ' verties = ' + verites + ' name='+name+' title='+name+' style="background:#F2F2F2">' + name.substring(0,15) + '...</li>';
                                    } else {
                                        html = html + '<li lon = ' + lon + ' lat = ' + lat + ' verties = ' + verites + ' name='+name+'  title='+name+' style="background:#F2F2F2">' + name + '</li>';
                                    }
                                } else if (i%2 == 0){
                                    if (name.length > 15) {
                                        html = html + '<li lon = ' + lon + ' lat = ' + lat + ' verties = ' + verites + ' name='+name+' title='+name+' style="background:white">' + name.substring(0,15) + '...</li>';
                                    } else {
                                        html = html + '<li lon = ' + lon + ' lat = ' + lat + ' verties = ' + verites + ' name='+name+'  title='+name+' style="background:white">' + name + '</li>';
                                    }
                                }

                            }
                            html = html + '</ul></div>';
                            var contentobj = {
                                title : 'Valuable area list',
                                content : html,
                                titleSize : '14',
                                marginLeft : 15,
                                callbackfunction : function() {
                                    var children = GisUtils.getDom('overlapping_polygon_list').firstChild.children;
                                    for ( var i = 0, len = children.length; i < len; i++) {
                                        children[i].onclick = function() {
                                            var lon = parseFloat(this.attributes[5].nodeValue);
                                            var lat = parseFloat(this.attributes[4].nodeValue);
                                            var verties = this.attributes[3].nodeValue;
                                            var polygonname = this.attributes[2].nodeValue;

                                            removeAllPopup();
                                            callbackFun({
                                                polygonName : polygonname,
                                                polygonCenterLonLat : {
                                                    lon : lon,
                                                    lat : lat
                                                },
                                                polygonVerties : verties
                                            });

                                            highlightPolygon(polygonname, polygonLineLayerList);
                                        };
                                    }
                                }
                            };
                            highlightPolygonName = null;
                            addPopupWithTitle(lineCenterCoordinate, contentobj, 200, 100, 1, 'blue-ucd', 0);

                            var liList = GisUtils.getDom('overlapping_polygon_list').firstChild.children;
                            for ( var i = 0, len = liList.length; i < len; i++) {
                                var liNode = liList[i];
                                liNode.onclick = function() {
                                    var lon = parseFloat(this.attributes[5].nodeValue);
                                    var lat = parseFloat(this.attributes[4].nodeValue);
                                    var verties = this.attributes[3].nodeValue;
                                    var polygonname = this.attributes[2].nodeValue;

                                    removeAllPopup();
                                    callbackFun({
                                        polygonName : polygonname,
                                        polygonCenterLonLat : {
                                            lon : lon,
                                            lat : lat
                                        },
                                        polygonVerties : verties
                                    });

                                    highlightPolygon(polygonname, polygonLineLayerList);
                                };
                            }

                            for ( var i = mapObj.controls.length - 1; i >= 0; i--) {
                                var isSelectCtl = mapObj.controls[i] instanceof OpenLayers.Control.SelectFeature;
                                if (isSelectCtl) {
                                    mapObj.controls[i].unselectAll();
                                    break;
                                }
                            }
                        }
                    },
                    'featureunselected' : function(evt) {
                        GisUtils.getDom('importantWarning' + uuid_value).style.cssText = importantWarningCss;
                        GisUtils.getDom('backslash' + uuid_value).style.cssText = backslashCss;
                        GisUtils.getDom('totalWarning' + uuid_value).style.cssText = totalWarningCss;
                        GisUtils.getDom('unit' + uuid_value).style.cssText = unitCss;
                        GisUtils.getDom('polygonName' + uuid_value).style.cssText = nameCss;
                        var polygonLineLayer = polygonLineLayerList.get(polygonName);
                        polygonLineLayer.styleMap = defaultStyleMap;
                        polygonLineLayer.redraw();
                    }
                },
                displayInLayerSwitcher : false
            };
        }

        // updateAllPopupAfterZoom 时调用
        polygonSelectStyleMap = new OpenLayers.StyleMap({
            'default' : new OpenLayers.Style({
                fillColor : strokeColorCLK,
                fillOpacity:fillOpcity,
                cursor : 'pointer',
                strokeColor: strokeColorCLK,
                strokeOpacity: fillOpcity
            }),
            'temporary' : new OpenLayers.Style({
                fillColor : strokeColorCLK,
                fillOpcity:fillOpcity,
                cursor : 'pointer'
            }),
            'select' : new OpenLayers.Style({
                fillColor : strokeColorCLK,
                cursor : 'pointer'
            })
        });

        polygonStyleMap = new OpenLayers.StyleMap({
            'default' : new OpenLayers.Style({
                fillColor : '${fillColor}',
                fillOpacity:fillOpcity,
                cursor : 'pointer',
                strokeColor: '${fillColor}',
                strokeOpacity: fillOpcity
            }),
            'temporary' : new OpenLayers.Style({
                fillColor : strokeColorCLK,
                fillOpcity:fillOpcity,
                cursor : 'pointer'
            }),
            'select' : new OpenLayers.Style({
                fillColor : strokeColorCLK,
                cursor : 'pointer'
            })
        });
        var optionsPolygon = {
            styleMap : polygonStyleMap,
            eventListeners:{
                'featureselected': function (event) {
                    var selectFeature = event.feature;
                    var polygonName = selectFeature.attributes.id;
                    var centerLonLat = selectFeature.geometry.bounds.centerLonLat;
                    var polygonVerties = selectFeature.geometry.getVertices();
                    callbackFun({
                        polygonName : polygonName,
                        polygonCenterLonLat : centerLonLat,
                        polygonVerties : polygonVerties
                    });
                },
                'featureunselected' : function(evt) {
                    if (!polygonLayerList.isEmpty()) {
                        if (GisUtils.isvalidString(highlightPolygonName)) {
                            var polygonLayer = polygonLayerList.get(highlightPolygonName);
                            if (null != polygonLayer && undefined != polygonLayer) {
                                polygonLayer.styleMap = polygonStyleMap;
                                polygonLayer.redraw();
                            }
                        }
                    }
                }
            },
            displayInLayerSwitcher : false
        };
        var layerold = polygonLayerList.get(polygonName);
        if (layerold == null) {
            var layer = new OpenLayers.Layer.Vector(polygonName,optionsPolygon);
            if (typeof(fillOpcity) != 'undefined') {
                layer.setOpacity(fillOpcity);
            }else{
                layer.setOpacity(0.3);
            }
            mapObj.addLayer(layer);
            layerPolygonVector.push(layer);
            polygonLayerList.put(polygonName,layer); // 存放多边形层
            polygonVertiesList.put(polygonName, polygonVertices); // 存放多边形顶点
            polygonColorList.put(polygonName, fillColor); // 存放多边形填充颜色
        }
        layerold = polygonLayerList.get(polygonName); // 获取多边形外边线图层


        var polygonLineLayerold = polygonLineLayerList.get(polygonName);
        if (polygonLineLayerold == null) { // 创建多边形外边线图层
            var polygonLineLayer = new OpenLayers.Layer.Vector(polygonName, polygonLineOptions);
            mapObj.addLayer(polygonLineLayer);
            layerPolygonLineVector.push(polygonLineLayer);
            polygonLineLayerList.put(polygonName, polygonLineLayer);
        }
        polygonLineLayerold = polygonLineLayerList.get(polygonName);

        var vectorList = [];
        var pointList = new Array();
        if (lonlats != null && length > 0) {
            for (var i = 0; i< length; i++) {
                var lonlat = lonlats[i];
                var lonlatArray = lonlat.split(",");
                var lon = parseFloat(lonlatArray[0]);
                var lat = parseFloat(lonlatArray[1]);
                var location = new OpenLayers.Geometry.Point(lon,lat);
                mapMgrObj.transform(location);
                pointList.push(location);
            }
        }
        /************************************RUANQ*******************************************/
        polygonLineLayerold.removeAllFeatures();
        var lineFeatureArray = new Array();
        var jsonObj = null;
        if (isShowTips) {
            jsonObj = {
                    floatCon:polygonName
            };
        }
        for (var i = 0; i < pointList.length; i++) {
            var pointArray = new Array();
            pointArray.push(pointList[i]);
            if (i == pointList.length-1) {
                pointArray.push(pointList[0]);
            } else {
                pointArray.push(pointList[i + 1]);
            }
            var lineString = new OpenLayers.Geometry.LineString(pointArray); //  每两个顶点组装一条线段
            var lineFeature = new OpenLayers.Feature.Vector(lineString);
            lineFeature.attributes = {
                    startPoint : pointArray[0], // 线段起点
                    endPoint : pointArray[1], // 线段终点
                    jsonObj: jsonObj
            };
            lineFeatureArray.push(lineFeature);
        }
        if (isSupportLineStringClick) { // true时，绘制多边形外边线，不然不绘制外边线
            polygonLineLayer.addFeatures(lineFeatureArray);
        }
        /************************************RUANQ*******************************************/


        var ring = new OpenLayers.Geometry.LinearRing(pointList);
        var polygon = new OpenLayers.Geometry.Polygon([ring]);
        var feature = new OpenLayers.Feature.Vector(polygon);
        feature.attributes = {
                id : polygonName,
                fillColor : fillColor
        };
        vectorList.push(feature);
        layerold.removeAllFeatures();
        if(null == polygonVertices){
            layerold.removeAllFeatures({
                    silent : true
            });
            mapObj.removeLayer(layerold);
        }else{
            layerold.addFeatures(vectorList);
            var centerLonLat = layerold.features[0].geometry.getBounds().getCenterLonLat();
            polygonCenterLonLatList.put(polygonName, centerLonLat);
            var markersLayer = new OpenLayers.Layer.Markers(polygonName, {displayInLayerSwitcher: false});
            layerMarkers.push(markersLayer);
            markerLayerList.put(polygonName, markersLayer);
            mapObj.addLayer(markersLayer);
            var size = new OpenLayers.Size(1,1);
            var offset = new OpenLayers.Pixel(-35, -30);
            var icon = new OpenLayers.Icon(rootPath + 'resource/img/icon/touming.png',size,offset);

            var importantWarningfontColor = 'red';
            var importantWarningfontSize = 24;
            var importantWarningvalue = '';
            if (null != importantWarning && '' != importantWarning && undefined != importantWarning) {
                if (importantWarning.fontColor != null && '' != importantWarning.fontColor && undefined != importantWarning.fontColor) {
                    importantWarningfontColor = importantWarning.fontColor;
                }
                importantWarningCss+='color:'+importantWarningfontColor+';';
                if(importantWarning.fontSize != null && '' != importantWarning.fontSize && undefined != importantWarning.fontSize){
                    importantWarningfontSize = importantWarning.fontSize;
                }
                importantWarningCss+='font-size:'+importantWarningfontSize+';';
                if(null != importantWarning.importantWarningCss && importantWarning.importantWarningCss!=''){
                    importantWarningCss+=importantWarning.importantWarningCss;
                }
                if(null != importantWarning.value && '' != importantWarning.value && undefined != importantWarning.value){
                    importantWarningvalue = importantWarning.value;
                }
            }

            
            var backslashfontColor = '#31B1D1';
            var backslashfontSize = 24;
            var backslashvalue = '';
            if (null != backslash && '' != backslash && undefined != backslash) {
                if (backslash.fontColor != null && '' != backslash.fontColor && undefined != backslash.fontColor) {
                    backslashfontColor = backslash.fontColor;
                }
                backslashCss+='color:'+backslashfontColor+';';
                if(null != backslash.fontSize && '' != backslash.fontSize && undefined != backslash.fontSize){
                    backslashfontSize = backslash.fontSize;
                }
                backslashCss+='font-size:'+backslashfontSize+';';
                if(null!=backslash.backslashCss && backslash.backslashCss != ''){
                    backslashCss+= backslash.backslashCss;
                }
                if(null != backslash.value && '' != backslash.value && undefined != backslash.value){
                    backslashvalue = backslash.value;
                }
            }

            
            var totalWarningfontColor = '#31B1D1';
            var totalWarningfontSize = 16;
            var totalWarningvalue = '';
            if (null != totalWarning && '' != totalWarning && undefined != totalWarning) {
                if (totalWarning.fontColor != null && '' != totalWarning.fontColor && undefined != totalWarning.fontColor) {
                    totalWarningfontColor = totalWarning.fontColor;
                }
                totalWarningCss+='color:'+totalWarningfontColor+';';
                if(null != totalWarning.fontSize && '' != totalWarning.fontSize && undefined != totalWarning.fontSize){
                    totalWarningfontSize = totalWarning.fontSize;
                }
                totalWarningCss+='font-size:'+totalWarningfontSize+';';
                if(null != totalWarning.totalWarningCss && totalWarning.totalWarningCss != ''){
                    totalWarningCss+= totalWarning.totalWarningCss;
                }
                if(null != totalWarning.value && '' != totalWarning.value && undefined != totalWarning.value){
                    totalWarningvalue = totalWarning.value;
                }
            }


            var unitfontColor = '';
            var unitfontSize = 14;
            var unitvalue = '';
            if (null != unit && '' != unit && undefined != unit) {
                if (null != unit.fontColor && '' != unit.fontColor && undefined != unit.fontColor) {
                    unitfontColor = unit.fontColor;
                }
                unitCss+='color:'+unitfontColor+';';
                if(null != unit.fontSize && '' != unit.fontSize && undefined != unit.fontSize){
                    unitfontSize = unit.fontSize;
                }
                unitCss+='font-size:'+unitfontSize+';';
                if(null != unit.unitCss && unit.unitCss != ''){
                    unitCss += unit.unitCss;
                }
                if(null != unit.nameCss && unit.nameCss != ''){
                    nameCss += unit.nameCss;
                }
                if(null != unitfontSize && '' != unitfontSize && undefined != unitfontSize){
                    unitvalue = unit.value;
                }
            }

            var html = '';
            if (polygonNameLength != null && typeof(polygonNameLength) != 'undefined' && typeof(polygonNameLength) == 'number') {
                if (polygonNameLength == 0) { // 不显示多边形名称
                    html = "<div style='text-align:left;'  id= 'polygonMarkerLabelId'>";
                    if (null != importantWarning) {
                        html = html + "<span id ='importantWarning"+uuid_value+"' style='"+importantWarningCss+"'>"+importantWarningvalue+"</span>";
                    }
                    if (null != backslash) {
                        html = html + "<span id ='backslash"+uuid_value+"' style='"+backslashCss+"'>"+backslashvalue+"</span>";
                    }

                    if (null != totalWarning) {
                        html = html + "<span id ='totalWarning"+uuid_value+"' style='"+totalWarningCss+"'>"+totalWarningvalue+"</span>";
                    }

                    if (null != unit) {
                        html = html + "<span id ='unit"+uuid_value+"'style='"+unitCss+"'>"+unitvalue+"</span><br>";
                    }
                    html = html + "</div>";
                } else {
                    if (polygonName.length >= polygonNameLength) {
                        html = html + "<div style='text-align:left;'  id= 'polygonMarkerLabelId'>";
                        if (null != importantWarning) {
                            html = html + "<span id ='importantWarning"+uuid_value+"' style='"+importantWarningCss+"'>"+importantWarningvalue+"</span>";
                        }

                        if (null != backslash) {
                            html = html + "<span id ='backslash"+uuid_value+"' style='"+backslashCss+"'>"+backslashvalue+"</span>";
                        }

                        if (null != totalWarning) {
                            html = html + "<span id ='totalWarning"+uuid_value+"' style='"+totalWarningCss+"'>"+totalWarningvalue+"</span>";
                        }

                        if (null != unit) {
                            html = html + "<span id ='unit"+uuid_value+"' style='"+unitCss+"'>"+unitvalue+"</span><br>";
                        }
                        html = html + "<span id ='polygonName"+uuid_value+"' style='"+nameCss+"'>"+polygonName.substr(0, polygonNameLength)+ "...</span></div>";
                    } else {
                        html = html + "<div style='text-align:left;' id= 'polygonMarkerLabelId'>";
                        if (null != importantWarning) {
                            html = html + "<span id ='importantWarning"+uuid_value+"' style='"+importantWarningCss+"'>"+importantWarningvalue+"</span>";
                        }

                        if (null != backslash) {
                            html = html + "<span id ='backslash"+uuid_value+"' style='"+backslashCss+"'>"+backslashvalue+"</span>";
                        }

                        if (null != totalWarning) {
                            html = html + "<span id ='totalWarning"+uuid_value+"' style='"+totalWarningCss+"'>"+totalWarningvalue+"</span>";
                        }

                        if (null != unit) {
                            html = html + "<span id ='unit"+uuid_value+"' style='"+unitCss+"'>"+unitvalue+"</span><br>";
                        }
                        html = html + "<span id ='polygonName"+uuid_value+"' style='"+nameCss+"'>"+ polygonName +"</span>" + "</div>";
                    }
                }
            } else { // 默认情况，多边形名称和marker显示
                html = html + "<div style='text-align:left;' id= 'polygonMarkerLabelId'>";
                if (null != importantWarning) {
                    html = html + "<span id ='importantWarning"+uuid_value+"' style='"+importantWarningCss+"'>"+importantWarningvalue+"</span>";
                }
                if (null != backslash) {
                    html = html + "<span id ='backslash"+uuid_value+"' style='"+backslashCss+"'>"+backslashvalue+"</span>";
                }
                if (null != totalWarning) {
                    html = html + "<span id ='totalWarning"+uuid_value+"' style='"+totalWarningCss+"'>"+totalWarningvalue+"</span>";
                }
                if (null != unit) {
                    html = html + "<span id ='unit"+uuid_value+"' style='"+unitCss+"'>"+unitvalue+"</span><br>";
                }
                html = html + "<span id ='polygonName"+uuid_value+"' style='"+nameCss+"'>"+ polygonName +"</span>" + "</div>";
            }
            markersLayer.addMarker(new OpenLayers.Marker.Label(centerLonLat, icon, html));
        }

        refreshSingleSelectCtlLayer(isSupportLineStringClick);
        return true;
    };

    /**
     * 通过多边形名称获取多边形中心点。
     * 
     * @param polygonName
     *            {String} 多边形名称
     * @return Object = {'lon':0, 'lat':0}
     */
    var getPolygonCenterLonLat = function(polygonName) {
        if (polygonCenterLonLatList != null
                && polygonCenterLonLatList.size() > 0) {
            return polygonCenterLonLatList.get(polygonName);
        }
    };

    /**
     * 设置多边形透明厚度。
     * 
     * @param {多边形名称}
     *            polygonName
     * @param {透明度}
     *            opacity
     */
    var setPolygonOpacity = function(polygonName, opacity) {
        if (polygonName != null && polygonName != ''
                && polygonName != 'undefined' && polygonName != 'NaN') {
            if (polygonLayerList != null && polygonLayerList.keys.length > 0) {
                if (polygonLayerList.containsKey(polygonName)) {
                    var layer = polygonLayerList.get(polygonName);
                    layer.setOpacity(opacity);
                }
            }
        } else {
            if (polygonLayerList != null && polygonLayerList.keys.length > 0) {
                for ( var key in polygonLayerList.keys) {
                    polygonLayerList.get(polygonLayerList.keys[key])
                            .setOpacity(opacity);
                }
            }
        }
    };

    /**
     * 修改已存在的多边形。
     * 
     * @param {String}
     *            polygonName 多边形形名称
     * @param {String}
     *            polygonVertices 多边形顶点
     * @return {Boolean}
     */
    var reDrawPolygon = function(polygonName, polygonVertices) {
        var newVertiesStr = getLineControlPointStr();// 获取用户预先修改时绘制的顶点，只要前两个顶点
        if (mapMgrObj.isNotNull(polygonName)
                && mapMgrObj.isNotNull(polygonVertices)
                && mapMgrObj.isNotNull(newVertiesStr)) {
            var oldVertiesStrArray = polygonVertices.slice(0,
                    polygonVertices.length - 1).split(";");
            var newVertiesStrArray = newVertiesStr.slice(0,
                    newVertiesStr.length - 1).split(";");

            var newVertiesAccount = newVertiesStrArray.length;

            if (mapMgrObj.isNotNull(newVertiesStrArray)
                    && newVertiesAccount == 2) {
                return changePolygonSize(polygonName, oldVertiesStrArray,
                        newVertiesStrArray);
            } else if (mapMgrObj.isNotNull(newVertiesStrArray)
                    && newVertiesAccount > 2) {
                return editPolygon(polygonName, newVertiesStr,
                        oldVertiesStrArray, newVertiesStrArray);
            }
        } else {
            return false;
        }
    };

    /**
     * 内部调用，修改多边形时，只改变多边形大小。
     * 
     * @param {String}
     *            polygonName 多边形名称
     * @param {Array(String)}
     *            oldVertiesStrArray
     * @param {Array(String)}
     *            newVertiesStrArray
     * @return {Boolean}
     */
    function changePolygonSize(polygonName, oldVertiesStrArray,
            newVertiesStrArray) {
        var oldPointAccount = oldVertiesStrArray.length;
        var distanceArray = [];
        var targetIndex = 0;
        var pointList = [];
        var newVertiesStart = newVertiesStrArray[0];
        var newVertiesEnd = newVertiesStrArray[1];
        if (oldPointAccount > 0) {
            for ( var i = 0; i < oldPointAccount; i++) {
                var lonlat = oldVertiesStrArray[i];
                var distance = mapMgrObj.calDistanceBetweenTwoPoint(
                        newVertiesStart, lonlat);
                distanceArray.push(distance);
            }
        }

        var minDistance = mapMgrObj.calMinNumInArray(distanceArray);
        if (distanceArray != null && distanceArray.length > 0) {
            for ( var j = 0; j < distanceArray.length; j++) {
                if (distanceArray[j] == minDistance) {
                    targetIndex = j;
                }
            }
        }
        oldVertiesStrArray.splice(targetIndex, 1, newVertiesEnd);
        if (oldPointAccount > 0) {
            for ( var i = 0; i < oldPointAccount; i++) {
                var lonlat = oldVertiesStrArray[i];
                var lonlatArray = lonlat.split(",");
                var lon = parseFloat(lonlatArray[0]);
                var lat = parseFloat(lonlatArray[1]);
                var location = new OpenLayers.Geometry.Point(lon, lat);
                pointList.push(location);
            }
        }
        var linearRing = new OpenLayers.Geometry.LinearRing(pointList);
        var linearRingVerties = linearRing.getVertices();// 重新获取线环Point
        if (mapMgrObj.judgePolygonIsCross(linearRingVerties)) {
            alert("多边形区域有重叠，请重画！");
            linearRingVertiesStr = null;
            return false;
        }
        linearRingVertiesStr = convertVertices2StringNo(linearRingVerties);// 返回给用户，用于在数据库保存
        var polygon = new OpenLayers.Geometry.Polygon([linearRing]);
        mapMgrObj.transform(polygon);
        var feature = new OpenLayers.Feature.Vector(polygon);
        var layerold = polygonLayerList.get(polygonName);
        layerold.removeAllFeatures(); // 删除layer上原来的组件
        layerold.addFeatures([feature]); // 重新给layer上添加组件
        removePolygonVertiesList(polygonName); // 清除内存中原有多边形顶尖
        polygonVertiesList.put(polygonName, linearRingVertiesStr); // 将多边形新顶点保存在内存中
        return true;
    }

    /**
     * 
     * @param polygonName
     *            {String} 多边形名称
     * @param newVertiesStr
     *            {String} 新增顶点
     * @param oldVertiesArray
     *            {Array} 多边形原来顶点
     * @param newVertiesArray
     *            {Array} 新增顶点
     * @returns {Boolean} if modify success return true, else return false
     */
    function editPolygon(polygonName, newVertiesStr, oldVertiesArray,
            newVertiesArray) {
        var distanceArrayStart = []; // 存放起始点与多边形原顶点比对的距离
        var distanceArrayEnd = []; // 存放终点与多边形原顶点比对的距离
        var vertiesInGeometry = []; // 存放当新绘制的所有顶点都在原来多边形内的情况
        var start = 0; // 连线起点索引
        var end = 0; // 连线终点索引
        var startVerties = newVertiesArray[0];
        var endVerties = newVertiesArray[newVertiesArray.length - 1];

        for ( var j = 0; j < oldVertiesArray.length; j++) {
            var lonlat = oldVertiesArray[j];
            var distanceStart = mapMgrObj.calDistanceBetweenTwoPoint(
                    startVerties, lonlat);
            var distanceEnd = mapMgrObj.calDistanceBetweenTwoPoint(endVerties,
                    lonlat);
            distanceArrayStart.push(distanceStart);
            distanceArrayEnd.push(distanceEnd);
            if (GisUtils.isInsidePolygon(newVertiesStr, lonlat)) {
                vertiesInGeometry.push(lonlat);
            }
        }

        var minDistanceStart = mapMgrObj.calMinNumInArray(distanceArrayStart);
        for ( var i = 0; i < distanceArrayStart.length; i++) {
            if (distanceArrayStart[i] == minDistanceStart) {
                start = i;
            }
        }

        var minDistanceEnd = mapMgrObj.calMinNumInArray(distanceArrayEnd);
        for ( var j = 0; j < distanceArrayEnd.length; j++) {
            if (distanceArrayEnd[j] == minDistanceEnd) {
                end = j;
            }
        }

        if (start == end || vertiesInGeometry.length == oldVertiesArray.length) { // 当新绘制的多边形都在原来多边形内的情况下会执行此分支
            var pointLst = [];
            for ( var i = 0; i < newVertiesArray.length; i++) {
                var lonlat = newVertiesArray[i];
                var lonlatArray = lonlat.split(",");
                var lon = parseFloat(lonlatArray[0]);
                var lat = parseFloat(lonlatArray[1]);
                var location = new OpenLayers.Geometry.Point(lon, lat);
                pointLst.push(location);
            }
            var lineRing = new OpenLayers.Geometry.LinearRing(pointLst);
            var linearRingVerties = lineRing.getVertices();
            linearRingVertiesStr = convertVertices2StringNo(linearRingVerties);
            var polygon = new OpenLayers.Geometry.Polygon([lineRing]);
            var transformInd = mapMgrObj.getTransformInd();
            if (transformInd) {
                mapMgrObj.transform(polygon);
            }
            var feature = new OpenLayers.Feature.Vector(polygon);
            var layerold = polygonLayerList.get(polygonName);
            layerold.removeAllFeatures();
            layerold.addFeatures([feature]);
            removePolygonVertiesList(polygonName);// 删除多边形顶点
            polygonVertiesList.put(polygonName, linearRingVertiesStr);// 更新多边形顶点
            return true;
        } else {
            // 重新组合 newVertiesArray 顶点, 不要起点和终点
            newVertiesArray = newVertiesArray.slice(1,
                    newVertiesArray.length - 1);
            if (start > 0 && end > 0) {
                var flat = 0;
                if (start < end) {
                    for ( var k = end; k < oldVertiesArray.length; k++) {
                        newVertiesArray.push(oldVertiesArray[k]);
                    }
                    for ( var l = 0; l <= start; l++) {
                        newVertiesArray.push(oldVertiesArray[l]);
                    }
                }
            } else if (start == 0) {
                for ( var i = end; i <= oldVertiesArray.length - 1; i++) {
                    newVertiesArray.push(oldVertiesArray[i]);
                }
                newVertiesArray.push(oldVertiesArray[0]);
            } else if (end == 0) {
                for ( var i = 0; i <= start; i++) {
                    newVertiesArray.push(oldVertiesArray[i]);
                }
            }

            var pointLst = [];
            for ( var i = 0; i < newVertiesArray.length; i++) {
                var lon = parseFloat(newVertiesArray[i].split(",")[0]);
                var lat = parseFloat(newVertiesArray[i].split(",")[1]);
                var location = new OpenLayers.Geometry.Point(lon, lat);
                pointLst.push(location);
            }
            var lineRing = new OpenLayers.Geometry.LinearRing(pointLst);
            linearRingVertiesStr = convertVertices2StringNo(lineRing
                    .getVertices());
            var polygon = new OpenLayers.Geometry.Polygon([lineRing]);
            var transformInd = mapMgrObj.getTransformInd();
            if (transformInd) {
                mapMgrObj.transform(polygon);
            }
            var feature = new OpenLayers.Feature.Vector(polygon);
            var layerold = polygonLayerList.get(polygonName);
            layerold.removeAllFeatures();
            layerold.addFeatures([feature]);
            removePolygonVertiesList(polygonName);// 删除多边形顶点
            polygonVertiesList.put(polygonName, linearRingVertiesStr);// 更新多边形顶点
            return true;
        }
        return false;
    }

    /**
     * 获取多边形最新顶点。与reDrawPolygon配合使用。
     * 
     * @return {String}
     */
    var getLinearRingVerties = function() {
        return linearRingVertiesStr;
    };

    var areaPolygon = function(linearVertiesStr) {
        var projection = new OpenLayers.Projection("EPSG:4326");
        var pointVerties = [];
        var verties = linearVertiesStr.split(";");
        if (verties.length < 3) {
            alert("传入参数错误");
        }
        for ( var index = 0; index < verties.length; index++) {
            var lonlat = verties[index].split(",");
            var lon = parseFloat(lonlat[0]);
            var lat = parseFloat(lonlat[1]);
            var location = new OpenLayers.Geometry.Point(lon, lat);
            pointVerties.push(location);
        }
        var lineRing = new OpenLayers.Geometry.LinearRing(pointVerties);
        var polygon = new OpenLayers.Geometry.Polygon([lineRing]);
        return polygon.getGeodesicArea(projection) + " " + "m" + "<sup>2</"
                + "sup>";
    };

    /**
     * 在地图图层上删除指定名称的多边形。
     * 
     * @param polygonName
     *            {String} 多边形名称 备注：对于数据不是动态获取而是由数据库获取的用户来说，想彻底删除多边形，
     *            需用户在前台调用java后台逻辑，删除数据库指定名称对应的多边形数据。
     */
    var delPolygonByName = function(polygonName) {
        setPolygonControlMode(false, null);
        if (polygonLayerList.size() > 0 && markerLayerList.size() > 0) {
            var layer = polygonLayerList.get(polygonName);
            var markersLayer = markerLayerList.get(polygonName);
            var polygonLineLayer = polygonLineLayerList.get(polygonName);
            if (null != polygonLineLayer && "" != polygonLineLayer
                    && "Undefined" != polygonLineLayer && null != layer
                    && "" != layer && "Undefined" != layer
                    && null != markersLayer && "" != markersLayer
                    && "Undefined" != markersLayer) {
                layer.removeAllFeatures({
                    silent : true
                });
                removePolygonLayerList(polygonName);
                mapObj.removeLayer(layer);

                polygonLineLayer.removeAllFeatures({
                    silent : true
                });
                removePolygonLineLayerList(polygonName);
                mapObj.removeLayer(polygonLineLayer);

                markersLayer.clearMarkers();
                removeMarkerLayerList(polygonName);
                mapObj.removeLayer(markersLayer);

                // 处理数组中重复的数据
                layerPolygonLineVector.splice(0, layerPolygonLineVector.length);
                layerPolygonVector.splice(0, layerPolygonVector.length);
                return true;
            }
        }
        return false;
    };

    /**
     * 在地图图层上删除所有多边形。 备注：对于数据不是动态获取而是由数据库获取的用户来说，想彻底删除多边形，
     * 需用户在前台调用java后台逻辑，删除数据库指定名称对应的多边形数据。
     */
    var delAllPolygon = function() {
        setPolygonControlMode(false, null);
        if (polygonLayerList.size() > 0) {
            var len = polygonLayerList.size();
            for ( var i = len - 1; i >= 0; i--) {
                var _key = polygonLayerList.keys[i];
                var _layer = polygonLayerList.vals[i];
                if (null != _layer && "" != _layer && "Undefined" != _layer) {
                    _layer.removeAllFeatures({
                        silent : true
                    });
                    removePolygonLayerList(_key);
                    mapObj.removeLayer(_layer);
                }
            }
        }
        if (polygonLineLayerList.size() > 0) {
            var len = polygonLineLayerList.size();
            for ( var i = len - 1; i >= 0; i--) {
                var _key = polygonLineLayerList.keys[i];
                var _layer = polygonLineLayerList.vals[i];
                if (null != _layer && "" != _layer && "Undefined" != _layer) {
                    _layer.removeAllFeatures({
                        silent : true
                    });
                    removePolygonLineLayerList(_key);
                    mapObj.removeLayer(_layer);
                }
            }
        }
        if (markerLayerList.size() > 0) {
            var len = markerLayerList.size();
            for ( var i = len - 1; i >= 0; i--) {
                var _key = markerLayerList.keys[i];
                var _layer = markerLayerList.vals[i];
                if (null != _layer && "" != _layer && "Undefined" != _layer) {
                    removeMarkerLayerList(_key);
                    mapObj.removeLayer(_layer);
                }
            }
        }
    };

    /** **************************************多边形业务******************************************* */

    /**
     * 将多边形顶点坐标信息转换成字符串形式。
     * 
     * @param polygonVertices
     *            {Array} 多边形顶点坐标数组
     * @return {String} 顶点坐标字符串
     */
    var convertVertices2String = function(polygonVertices) {
        return mapMgrObj.convertVertices2String(polygonVertices);
    };

    var convertVertices2StringNo = function(polygonVertices) {
        return mapMgrObj.convertVertices2StringNo(polygonVertices);
    };

    /**
     * 手动在地图上加站开关，mode值为true时进入手动加站模式，点击即可增加站点
     * callBackFuncAfterAddSite为加站完成后回调函数，可缺省
     */
    var setAddSiteMode = function(mode, callBackOnComplete) {
        isAddSiteMode = mode;
        callBackFuncAfterAddSite = callBackOnComplete;
    };

    /**
     * 手动在地图上删除站点开关，开关，值为true时进入手动加站模式，点击即可增加站点
     */
    var setDeleteSiteMode = function(mode, callBackOnComplete) {
        isDeleteSiteMode = mode;
        callBackFuncAfterDeleteSite = callBackOnComplete;
    };

    /**
     * 返回是否打开删除站点开关
     */
    var getDeleteSiteMode = function() {
        return isDeleteSiteMode;
    };

    /**
     * 返回删除站点回调函数
     */
    var getDeleteSiteCallBack = function() {
        return callBackFuncAfterDeleteSite;
    };

    /**
     * 设置移动基站模式，mode为true时可移动基站
     */
    var setMoveSiteMode = function(mode) {
        mapMgrObj.setMoveSiteMode(mode);
        for ( var i = 0; i < moveSiteControls.length; i++) {
            var control = moveSiteControls[i];
            // 根据入参激活移动站点的控制层
            if (mode) {
                control.activate();
            } else {
                control.deactivate();
            }
        }
    };

    /**
     * 设置移动自定义图形，mode为true时可移动自定义图形
     */
    var setMoveCustomerMode = function(mode) {
        mapMgrObj.setMoveCustomerMode(mode);
        for ( var i = 0; i < moveCustomerControls.length; i++) {
            var control = moveCustomerControls[i];
            // 根据入参激活移动站点的控制层
            if (mode) {
                control.activate();
            } else {
                control.deactivate();
            }
        }
    };

    /**
     * 返回当前是否是移动站点模式
     */
    var getMoveSiteMode = function() {
        return mapMgrObj.isMoveSiteMode();
    };

    /**
     * 参数小区ID数组 小区多选
     */
    var cellSelect = function(selectIds) {
        var layerItem = layermap.get(multiSelectLayerId);
        if (layerItem != null) {
            var layerPlugObj = layerItem.layerPlugObj;
            layerPlugObj.displaySCInformation(selectIds);
        }
    };
    // /**
    // * 设置矩形拖拽多选回调函数
    // */
    // var setDrawFeatureCallBack = function(callfunction){
    // mapMgrObj.setCallBackFunction(callfunction);
    // };
    //
    /**
     * 设置加站的小区所在的基站图层与小区图层
     */
    var setCurLayersForAddCell = function(siteLayerId, cellLayerId) {
        curAddSiteLayerId = siteLayerId;
        curAddCellLayerId = cellLayerId;
    };

    /***************************************************************************
     * 注册加站时获取小区具体信息的回调事件，返回需要增加小区的JSON串，地图根据此信息绘制对应小区图形
     */
    var registerAddSiteEvent = function(callBackFunc) {
        addSiteInfoCallBackFunc = callBackFunc;
    };

    /**
     * 编辑小区信息后，根据更新后的信息重绘小区图形，同时保存新的小区信息
     */
    var editCellInfo = function(jsonObj, layerId) {
        var layerItem = layermap.get(layerId);
        if (layerItem != null && layerItem.layerPlugObj != null
                && typeof (layerItem.layerPlugObj.editCellInfo) == 'function') {
            layerItem.layerPlugObj.editCellInfo(jsonObj);
        }
    };

    /**
     * 编辑新加小区信息后，根据更新后的信息重绘小区图形，同时保存新的小区信息
     */
    var editNewAddCellInfo = function(jsonObj, layerId) {
        var layerItem = layermap.get(layerId);
        if (layerItem != null
                && layerItem.layerPlugObj != null
                && typeof (layerItem.layerPlugObj.editNewAddCellInfo) == 'function') {
            layerItem.layerPlugObj.editNewAddCellInfo(jsonObj);
        }
    };

    var dataJson = function(layerId) {
        var layerItem = layermap.get(layerId);
        return layerItem.layerPlugObj.dataJson();
    };

    /**
     * 设置加站时站点类型，单小区基站，双小区基站和三小区基站
     */
    var setAddSiteParam = function(param) {
        addSiteParam = param;
    };

    /**
     * 给地图对象添加移动基站的控制层，定义响应事件
     * 
     * @param siteLayerId
     *            需要加控制的基站图层ID
     * @param cellLayerId
     *            基站对应的制式的小区图层ID
     * @param callBackFunc
     *            加站完成后的回调函数
     * @param auto
     *            如果为null，移动基站后自动去激活，否则需要通过开关来控制
     */
    var addMoveSiteControl = function(siteLayerId, cellLayerId, callBackFunc,
            auto) {
        var siteLayerItem = layermap.get(siteLayerId);
        var cellLayerItem = layermap.get(cellLayerId);
        if (mapObj != null && siteLayerItem != null) {
            var moveSiteControl = new OpenLayers.Control.DragFeature(
                    siteLayerItem.layerObj);
            mapObj.addControl(moveSiteControl);
            /**
             * 拖动基站时，拖动完成后的响应事件,即拖动完成后更新基站小区位置，同时重绘图形
             */
            var onMoveSiteComplete = function(feature, pixel) {
                var newLonlat = mapObj.getLonLatFromPixel(pixel);
                newLonlat = mapMgrObj.reTransform(newLonlat);
                var obj = feature.attributes.jsonObj;
                siteLayerItem.layerPlugObj.updataJsonLonLatById(obj, newLonlat);
                cellLayerItem.layerPlugObj.moveCellsBySiteId(obj.id,
                        cellLayerItem.layerParms.netWork, newLonlat,
                        callBackFunc);
                moveSiteControl.feature = null;
                if (auto == null) {
                    moveSiteControl.deactivate();
                    mapMgrObj.setMoveSiteMode(false);
                }
            };
            moveSiteControl.onComplete = onMoveSiteComplete;
            var onStart = function(feature, pixel) {
                var jsonObj = feature.attributes.jsonObj;
                if (!jsonObj.isAdded) {
                    moveSiteControl.deactivate();
                }
            };
            moveSiteControl.onStart = onStart;
            moveSiteControls.push(moveSiteControl);
        }
    };

    /**
     * 将基站整体移动到指定的经纬度位置上
     */
    var moveSiteToLonlat = function(jsonObj, siteLayerId, callBackFunc) {
        var siteLayerItem = layermap.get(siteLayerId);
        var siteLayer = siteLayerItem.layerPlugObj;
        siteLayer.moveSiteToLonlat(jsonObj, callBackFunc);
        setMapCenter(jsonObj.lon, jsonObj.lat);
    };

    /**
     * 将小区对象数组转化为按要求导出的数组
     */
    var cellArr2ExportArr = function(cellArr, netWork) {
        var resultArr = [];
        var cellInfoObj = null;
        var cellObj = null;
        for ( var i = 0; i < cellArr.length; i++) {
            cellObj = cellArr[i];
            cellInfoObj = {
                lon : cellObj.lon,
                lat : cellObj.lat,
                azimuth : cellObj.angle,
                siteType : '1',
                cellName : cellObj.id,
                siteName : cellObj.siteId,
                full : 0,
                network : netWork
            };
            resultArr.push(cellInfoObj);
        }
        return resultArr;
    };

    /**
     * 导出所有手动添加的小区信息
     */
    var exportAddedCellInfos = function(cellLayerId) {
        var cellLayerItem = layermap.get(cellLayerId);
        var addedCellArr = cellLayerItem.layerPlugObj.exportAddedCellInfos();
        return cellArr2ExportArr(addedCellArr, cellLayerItem.layerParms.netWork);
    };

    /**
     * 获取多选小区信息
     */
    var getSelectCellInfo = function() {
        return mapMgrObj.getSelectCellInfo();
    };

    /**
     * 置空小区信息数组
     */
    var setSelectCellInfo = function() {
        mapMgrObj.setSelectCellInfo();
    };

    /**
     * 导出所有手动删除的小区信息
     */
    var exportDeletedCellInfos = function(cellLayerId) {
        var cellLayerItem = layermap.get(cellLayerId);
        var deleteCellArr = cellLayerItem.layerPlugObj.exportDeletedCellInfos();
        return cellArr2ExportArr(deleteCellArr,
                cellLayerItem.layerParms.netWork);
    };

    /**
     * 选中小区后再点删除小区
     */
    var deleteCellBySelectCellFeature = function(jsonObj, cellLayerId) {
        var cellLayerItem = layermap.get(cellLayerId);
        cellLayerItem.layerPlugObj.deleteCellBySelectCellFeature(jsonObj);
    };
    /**
     * 在选中的基站上增加一个小区
     */
    var addSingleCell2SelectedSite = function(siteLayerId, cellObj,
            callBackFunc) {
        var siteLayerItem = layermap.get(siteLayerId);
        if (siteLayerItem != null) {
            var cellLayer = siteLayerItem.layerPlugObj
                    .getCorrespondCellLayerObj();
            cellLayer.addSingleCell2SelectedSite(cellObj, callBackFunc);
        }
    };

    var getCurScale = function() {
        var scaleLine = mapObj
                .getControlsByClass("OpenLayers.Control.ScaleLine")[0];
        var scale = {};
        if (scaleLine.eBottom.style.visibility == "visible") {
            scale.topWidth = scaleLine.eTop.style.width;
            scale.topValue = scaleLine.eTop.innerHTML;
        }

        if (scaleLine.eTop.style.visibility == "visible") {
            scale.bottomwidth = scaleLine.eBottom.style.width;
            scale.bottomValue = scaleLine.eBottom.innerHTML;
        }
        return scale;
    };

    var isInMapExtents = function(lon, lat) {
        var lonOfSpecialMap = lon;
        var latOfSpecialMap = lat;
        var centerpoint = new OpenLayers.LonLat(lon, lat);
        if (mapMgrObj.getTransformInd()) {
            mapMgrObj.transform(centerpoint);
            lonOfSpecialMap = centerpoint.lon;
            latOfSpecialMap = centerpoint.lat;
        }
        var mapextent = mapObj.getExtent();
        if ((lonOfSpecialMap > mapextent.left)
                && (latOfSpecialMap > mapextent.bottom)
                && (lonOfSpecialMap < mapextent.right)
                && (latOfSpecialMap < mapextent.top)) {
            return true;
        } else {
            return false;
        }
    };
    /**
     * 获取图层的显示与否
     */
    var getLayerVisibility = function(layerId) {
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            return layerItem.visibleInd;
        }
        return false;
    };

    /**
     * 显示小区冲突信息
     */
    var displaySCInformation = function(cellLayerId, scCellArray, callBackFunc) {
        var layerItem = layermap.get(cellLayerId);
        // 设置为多选模式
        if (!getMultiSelectMode()) {
            setMultiSelectMode(cellLayerId, null, null, null);
        } else {
            // 已经处于多选模式下，清除所有已经选择的feature
            cancelMultiSelectMode();
            setMultiSelectMode(cellLayerId, null, null, null);
        }

        // 显示冲突小区，返回弹出信息框坐标
        if (null != layerItem) {
            layerItem.layerPlugObj.displaySCInformation(scCellArray);
            // 回调函数
            if (null != callBackFunc && typeof (callBackFunc) == 'function') {
                // 弹出信息框坐标点
                var centerLonLat = new OpenLayers.LonLat(
                        parseFloat(scCellArray[0].lon),
                        parseFloat(scCellArray[0].lat));
                mapMgrObj.transform(centerLonLat);
                callBackFunc(centerLonLat, scCellArray);
            }
        }
        // 取消多选模式
        cancelMultiSelectMode();
    };
    /**
     * 获取地图级别
     */
    var getMapZoomLevel = function() {
        return mapObj.getZoom();
    };

    var zoomTo = function(zoomLevel) {
        mapObj.zoomTo(zoomLevel);
    };

    var getMapCenter = function() {
        var currLonLat = mapObj.getCenter();
        mapMgrObj.reTransform(currLonLat);
        return currLonLat;
    };

    var addGridLayer = function(layerId, layerParmObj, callBackFunc) {
        var layer = new GridMapServerLayer(this, layerParmObj);
        if (layer != null) {
            var layerItem = new LayerItem(layerId, layerParmObj, callBackFunc);
            var layerObj = layer.initLayer(layerId);
            layerItem.layerPlugObj = layer;
            layerItem.layerObj = layerObj;
            layermap.put(layerId, layerItem);
        }
    };

    var cancelGridHighHight = function(gridLayerId) {
        // 根据传入的图层Id获取layerItem
        var layerItem = layermap.get(gridLayerId);
        // 判断layerItem是否为空
        if (typeof layerItem === 'undefined' || null == layerItem) {
            return;
        }
        layerItem.layerPlugObj.cancelGridHighHight();
    };

    var isLayerExist = function(layerId) {
        var layer = layermap.get(layerId);
        if (layer != 'undefined' && null != layer) {
            return true;
        }
        return false;
    };

    var zoomOut = function() {
        var curZoomLever = mapObj.getZoom();
        // 如果当前级别小于最小级别
        if (curZoomLever <= mapAppParmObj.minZoomLever) {
            mapObj.zoomTo(mapAppParmObj.minZoomLever);
            return;
        }
        mapObj.zoomOut();
    };

    var zoomIn = function() {
        var curZoomLever = mapObj.getZoom();
        // 如果当前级别大于最大级别
        if (curZoomLever >= mapAppParmObj.maxZoomLever) {
            mapObj.zoomTo(mapAppParmObj.maxZoomLever);
            return;
        }
        mapObj.zoomIn();
    };

    /**
     * start drawing angle
     */
    var startDrawAngle = function() {
        var renderer = OpenLayers.Util.getParameters(window.location.href).renderer;
        renderer = (renderer) ? [renderer]
                : OpenLayers.Layer.Vector.prototype.renderers;
        angleLayer = new OpenLayers.Layer.Vector("drawAngleLayer", {
            styleMap : new OpenLayers.StyleMap({
                'default' : {
                    strokeColor : "#31B1D1",
                    strokeWidth : 2,
                    fill : false,
                    label : "${angle}",
                    fontColor : "${favColor}",
                    labelAlign : "${align}",
                    labelXOffset : "${xOffset}",
                    labelYOffset : "${yOffset}",
                    labelOutlineColor : "#FFFFFF",
                    labelOutlineWidth : 3
                }
            }),
            renderers : renderer
        });
        drawAngleControl = new OpenLayers.Control.DrawAngle(angleLayer,
                OpenLayers.Handler.Path);
        mapObj.addControl(drawAngleControl);
        mapObj.addLayer(angleLayer);
        drawAngleControl.activate();
    };

    /**
     * stop drawing angle
     */
    var stopDrawAngle = function() {
        drawAngleControl.deactivate();
        mapObj.removeLayer(angleLayer);
        angleLayer = null;
        drawAngleControl = null;
    };

    /**
     * 设置国际化，目前只有在bing的中文地图切换中使用
     */
    var setCulture = function(_culture) {
        globalGisCulture = _culture;
    };

    // 创建内置定时器对象
    var createCustomInterval = function(layerId) {
        var intervalObj = new CustomInterval();
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var obj = layerItem.layerPlugObj;
            intervalObj.setIntervalObj(obj);
        }
        return intervalObj;
    };
    // 设置小区渐进色开关，false表示关闭，true表示打开
    var setIsProgressiveColor = function(flag) {
        for ( var i = 0; i < layermap.size(); i++) {
            layerPlugObj = layermap.vals[i].layerPlugObj;
            if (layerPlugObj.type == GisLayerType.CELL) {
                layerPlugObj.setIsProgressiveColor(flag);
            }
        }
    };
    // 获取小区渐进色开关标示
    var getIsProgressiveColor = function() {
        for ( var i = 0; i < layermap.size(); i++) {
            layerPlugObj = layermap.vals[i].layerPlugObj;
            if (layerPlugObj.type == GisLayerType.CELL) {
                return layerPlugObj.getIsProgressiveColor();
            }
        }
    };

    /**
     * 自定义图形选择事件
     */
    var activateCustomerSelectEvent = function() {
        setMoveCustomerMode(true);
    };
    /**
     * 注销自定义图形拖动事件
     */
    var deactivateCustomerSelectEvent = function() {
        setMoveCustomerMode(false);
    };

    /**
     * 创建自定义图层
     */
    var createCustomerLayer = function(layerId) {
        // 先清除上次绘制的元素
        this.removeLayer(layerId);
        // 开始重新添加图层
        this.addAppLayer(GisLayerType.USERDEFINED, layerId, {}, {});
        // 返回创建的图层Id
        return layerId;
    };

    /**
     * 删除绘制的图层
     */
    var removeCustomerLayer = function(layerId) {
        // 清除绘制的图形
        this.removeLayer(layerId);
        // 清除矩形
        this.delPolygonByName(layerId);
    };

    /**
     * 获取移动之后的经纬度
     */
    var getMoveLonlat = function() {
        return customerMoveSpace.lonlat;
    };

    /**
     * 移动自定义图形
     * 
     * @param layerId
     *            需添加控制的图层ID
     * @param auto
     *            如果为null，移动后自动去激活，否则需要通过开关来控制
     */
    var addMoveCustomerControl = function(layerId, auto, callBackFunc) {
        // 根据图层id获取图层新
        var layerItem = layermap.get(layerId);
        // 加载移动控件至图层中
        if (mapObj != null && layerItem != null) {
            var moveCustomerControl = new OpenLayers.Control.DragFeature(
                    layerItem.layerObj);
            mapObj.addControl(moveCustomerControl);
            // 设置拖动完成事件
            var onMoveComplete = function(feature, pixel) {
                // 获取起始经纬度
                var startLonlat = lonLatList.get("startLonlat");
                // 拖动后经纬度
                var newLonlat = mapObj.getLonLatFromPixel(pixel);
                newLonlat = mapMgrObj.reTransform(newLonlat);
                // 拖动距离
                var spaceLon = newLonlat.lon - startLonlat.lon;
                var spaceLat = newLonlat.lat - startLonlat.lat;

                var obj = feature.attributes.jsonObj;
                // 根据新的经纬度刷新圆形,三角形,扇形数据
                obj.lon = newLonlat.lon;
                obj.lat = newLonlat.lat;
                setCustomerGraphParam(obj);
                // 根据新的经纬度刷新矩形
                var lonlats = [];
                var neweLonLats = "";
                if (typeof (obj.polygonVertices) != "undefined") {
                    lonlats = obj.polygonVertices.split(";");
                    // 矩形四个点平移
                    for ( var i = 0; i < lonlats.length - 1; i++) {
                        var lonlat = lonlats[i];
                        var lonlatArray = lonlat.split(",");
                        lonlatArray[0] = spaceLon + parseFloat(lonlatArray[0]);
                        lonlatArray[1] = spaceLat + parseFloat(lonlatArray[1]);
                        var tempLotLat = lonlatArray[0] + "," + lonlatArray[1]
                                + ";";
                        neweLonLats = tempLotLat + neweLonLats;
                    }
                }
                obj.polygonVertices = neweLonLats;
                setCustomerPolygonParam(obj);
                // 根据新的经纬度刷新直线
                obj.startLon = spaceLon + obj.startLon;
                obj.startLat = spaceLat + obj.startLat;
                obj.endLon = spaceLon + obj.endLon;
                obj.endLat = spaceLat + obj.endLat;
                setCustomerLineParam(obj);
                // 拖动完成后保持拖动后的经纬度
                customerMoveSpace.lonlat = neweLonLats;
                // 拖动完成后执行回调函数
                if (null == callBackFunc) {
                    return;
                } else {
                    callBackFunc();
                }
            };
            var onStart = function(feature, pixel) {
                var startLonlat = mapObj.getLonLatFromPixel(pixel);
                startLonlat = mapMgrObj.reTransform(startLonlat);
                lonLatList = new GISHashMap();
                lonLatList.put("startLonlat", startLonlat);
            };
            moveCustomerControl.onStart = onStart;
            moveCustomerControl.onComplete = onMoveComplete;
            // 添加至可拖动数组中
            moveCustomerControls.push(moveCustomerControl);
        }
    };
    /**
     * 设置圆形,三角形,扇形数据
     * 
     * @param layerId
     *            图层Id
     * @param style
     *            线相关属性
     */
    var setCustomerGraphParam = function(style) {
        // 构造List集合
        var vectorList = [];
        // 定义属性集合
        var itemVec = {};
        // 构造数据
        itemVec.graphicType = style.graphicType;
        itemVec.lon = style.lon;
        itemVec.lat = style.lat;
        itemVec.azimuth = style.azimuth;
        itemVec.radius = style.radius;
        itemVec.opacity = style.opacity;
        itemVec.fillColor = style.fillColor;
        itemVec.strokeColor = style.strokeColor;
        itemVec.strokeWidth = style.strokeWidth;
        itemVec.angle = style.angle;
        // 添加至List中
        vectorList.push(itemVec);
        return vectorList;
    };

    /**
     * 设置直线数据
     * 
     * @param layerId
     *            图层Id
     * @param style
     *            线相关属性
     */
    var setCustomerLineParam = function(style) {
        // 构造List集合
        var vectorList = [];
        // 定义属性集合
        var itemVec = {};
        // 构造数据
        itemVec.graphicType = style.graphicType;
        itemVec.startLon = style.startLon;
        itemVec.startLat = style.startLat;
        itemVec.endLon = style.endLon;
        itemVec.endLat = style.endLat;
        itemVec.opacity = style.opacity;
        itemVec.fillColor = style.fillColor;
        itemVec.strokeColor = style.strokeColor;
        itemVec.strokeWidth = style.strokeWidth;
        // 添加至List中
        vectorList.push(itemVec);
        return vectorList;
    };
    /**
     * 设置矩形数据
     * 
     * @param layerId
     *            图层Id
     * @param style
     *            线相关属性
     */
    var setCustomerPolygonParam = function(style) {
        // 构造List集合
        var vectorList = [];
        // 定义属性集合
        var itemVec = {};
        // 构造数据
        itemVec.graphicType = style.graphicType;
        itemVec.polygonName = style.polygonName;
        itemVec.polygonVertices = style.polygonVertices;
        itemVec.color = style.color;
        itemVec.lineProperties = style.lineProperties;
        itemVec.fillOpcity = style.fillOpcity;
        // 添加至List中
        vectorList.push(itemVec);
        return vectorList;
    };
    /**
     * 绘制直线
     * 
     * @param layerId
     *            图层Id
     * @param style
     *            线相关属性
     */
    var drawCustomerLine = function(gisMapObj, layerId, style) {
        // 构造List集合
        var vectorList = setCustomerLineParam(style);
        // 设置图层数据
        gisMapObj.setLayerdata(layerId, vectorList, getSeqObj(layerId)
                .getNextVal());

    };
    /**
     * 绘制圆形，三角形，扇形
     * 
     * @param layerId
     *            图层Id
     * @param style
     *            需绘制的图形相关属性
     */
    var drawCustomerGraph = function(gisMapObj, layerId, style) {
        // 构造List集合
        var vectorList = setCustomerGraphParam(style);
        // 设置图层数据
        gisMapObj.setLayerdata(layerId, vectorList, getSeqObj(layerId)
                .getNextVal());

    };

    var getpolygonArea = function() {
        return mapMgrObj.getpolygonArea();
    };
    /**
     * 绘制矩形
     * 
     * @param layerId
     *            图层Id
     * @param style
     *            需绘制的图形相关属性
     * @param callBackFun
     *            绘制结束后回调函数
     */
    var drawCustomerPolygon = function(gisMapObj, layerId, style) {
        // 构造List集合
        var vectorList = setCustomerPolygonParam(style);
        // 设置图层数据
        gisMapObj.setLayerdata(layerId, vectorList, getSeqObj(layerId)
                .getNextVal());
    };
    /**
     * 获取点击处的经纬度
     * 
     * @param centerLonLat
     *            点击处经纬度
     */
    var getClickLonLat = function(clickLonLat) {
        return clickLonLat;

    };

    /**
     * 地图MouseMove事件接口
     */
    var getMouseMoveLonLat = function(mode, callBackFun) {
        // 给相应的地图注册点击事件
        customerMouseMoveCallBack = callBackFun;
        customerMouseMoveFlag = mode;
    };

    /**
     * calculate distance between LonLat in earth.
     * 
     * @param srcLonLat
     *            {Object} srcLonLat = {'lon': 0, 'lat': 0}
     * @param descLonLat
     *            {Object} descLonLat = {'lon': 0, 'lat': 0} return Float
     */
    var calcDistanceBetweenLonLat = function(srcLonLat, descLonLat) {
        return OpenLayers.Util.distVincenty(srcLonLat, descLonLat);
    };

    /**
     * 修改已选择的线宽和颜色
     * 
     * @param elementId
     *            {String} layerId 图层Id id 需要修改的线的ID strokeWidth 需要修改的线宽
     *            strokeColor 需要修改的线的颜色
     */
    var changeLineAttribute = function(layerId, id) {
        // 线宽颜色属性修改
        var layerItem = layermap.get(layerId);
        // 增加判断
        if (typeof layerItem === 'undefined' || null == layerItem) {
            return;
        }
        layerItem.layerPlugObj.changeLineAttribute(id);
        // 设置修改标志
        isModifyLineAttribute = true;
    };

    /**
     * 取消已选择的线宽和颜色 layerId 图层Id id 需要取消的线的ID
     * 
     * @param elementId
     *            {String}
     */
    var cancelLineChange = function(layerId, id) {
        // 线宽颜色属性修改
        var layerItem = layermap.get(layerId);
        // 增加判断
        if (typeof layerItem === 'undefined' || null == layerItem) {
            return;
        }
        layerItem.layerPlugObj.cancelLineChange(id);
    };

    /**
     * @param layerId
     *            {String} 图层名称
     * @param selectPrjParmID
     *            {Integer} 矢量元素id，数据库中唯一值
     */
    var getIsModifyLineAttribute = function(layerId) {
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerPlugObj = layerItem.layerPlugObj;
            return layerPlugObj.getIsModifyLineAttribute();
        } else {
            return null;
        }
    };

    /**
     * @param layerId
     *            {String} 图层名称
     * @param selectPrjParmID
     *            {Integer} 矢量元素id，数据库中唯一值
     */
    var getSelectLineAttribute = function(layerId) {
        var layerItem = layermap.get(layerId);
        if (layerItem != null) {
            var layerPlugObj = layerItem.layerPlugObj;
            return layerPlugObj.getSelectLineAttribute();
        } else {
            return null;
        }
    };

    var getUUidValue = function(len, radix) {
        var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
                .split('');
        var uuid = [], i;
        radix = radix || chars.length;

        if (len) {
            // Compact form
            for (i = 0; i < len; i++)
                uuid[i] = chars[0 | Math.random() * radix];
        } else {
            // rfc4122, version 4 form
            var r;

            // rfc4122 requires these characters
            uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
            uuid[14] = '4';

            // Fill in random data. At i==19 set the high bits of clock sequence
            // as
            // per rfc4122, sec. 4.1.5
            for (i = 0; i < 36; i++) {
                if (!uuid[i]) {
                    r = 0 | Math.random() * 16;
                    uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
                }
            }
        }

        return uuid.join('');
    };
    /**
     * 设置鼠标是否是拖动事件标志
     */
    var setMouseMoveFlag = function(flag) {
        isMapMouseMove = flag;
    };
    /**
     * 返回鼠标是否是拖动事件标志
     */
    var getMouseMoveFlag = function() {
        return isMapMouseMove;
    };
    /** ****************外部接口************************ */
    this.setCulture = setCulture;
    this.getCurScale = getCurScale;
    this.setRefreshLayerParam = setRefreshLayerParam;//
    this.refreshDataByLayer = refreshDataByLayer;//
    this.isOutSideDataExtent = isOutSideDataExtent;
    this.getDataExtent = getDataExtent;//
    this.refreshLayerDataExtent = refreshLayerDataExtent;
    this.initMap = initMap;//
    this.setMeasurementMode = setMeasurementMode;//
    this.setPolygonControlMode = setPolygonControlMode;//
    this.setLineControlMode = setLineControlMode;//
    this.setLineActivities = setLineActivities;//
    this.getPolygonControlPointStr = getPolygonControlPointStr;//
    this.setMapCenter = setMapCenter;//
    this.setMapExtent = setMapExtent;
    this.updateMapDivSize = updateMapDivSize;//
    this.locateMapCenter = locateMapCenter;
    this.removeLayer = removeLayer;//
    this.setLayerVisibility = setLayerVisibility;//
    this.setLayerOpacity = setLayerOpacity;//
    this.getLayerOpacity = getLayerOpacity;//
    this.setLayerdata = setLayerdata;//
    this.moveLayerToTop = moveLayerToTop;// 移动到顶部
    this.moveLayerToIndex = moveLayerToIndex;// 移动几个级别
    this.addCBBAppLayer = addCBBAppLayer;//
    this.addAppLayer = addAppLayer;//
    this.setPanZoomMode = setPanZoomMode;//
    this.unselectAllFeatures = unselectAllFeatures;
    this.setMultiSelectMode = setMultiSelectMode;
    this.getMultiSelectMode = getMultiSelectMode;
    this.getRefeshingInd = getRefeshingInd;
    this.setRefeshingInd = setRefeshingInd;
    this.cancelMultiSelectMode = cancelMultiSelectMode;
    this.disableMultiSelectMode = disableMultiSelectMode;
    this.removeSelectedObj = removeSelectedObj;
    this.addSelectedObj = addSelectedObj;
    this.refreshMultiSelectLayer = refreshMultiSelectLayer;
    this.addPopup = addPopup;//
    this.addPopupCustom = addPopupCustom;// RUANQ 定制弹出框
    this.addPopupWithTitle = addPopupWithTitle; // RUANQ 定制弹出框
    this.addPopupByLonlat = addPopupByLonlat;//
    this.setSelectedObj = setSelectedObj;
    this.setCellMode = setCellMode;
    this.lockRefresh = lockRefresh;
    this.unLockRefresh = unLockRefresh;
    this.removeAllPopup = removeAllPopup;
    this.terminate = terminate;
    this.setRefAppLayer = setRefAppLayer;
    this.clearAllSelectedObj = clearAllSelectedObj;
    this.registerLayerEvent = registerLayerEvent;
    this.setEventStatus = setEventStatus;
    this.disableLayerEvent = disableLayerEvent;
    this.lineAngle = lineAngle;
    this.setLayerVisibleRange = setLayerVisibleRange;
    this.setLableMinZoomLever = setLableMinZoomLever;
    this.getElevationForGoolge = getElevationForGoolge;
    this.createLayerForObjGroup = createLayerForObjGroup;// RQ
    // 创建图层，并在图层上添加元素。
    this.romoveLayerForZone = romoveLayerForZone;// RQ 删除zone组创建的图层。
    this.romoveAllLayerForZone = romoveAllLayerForZone;// RQ 删除所有zone图层
    this.drawPolygon = drawPolygon;// RQ 绘制多边形。
    this.getPolygonCenterLonLat = getPolygonCenterLonLat;// RQ 获取多边形中心点经纬度
    this.setPolygonOpacity = setPolygonOpacity;// RQ 设置多边形透明度
    this.reDrawPolygon = reDrawPolygon;// RQ 修改多边形。
    this.getLinearRingVerties = getLinearRingVerties;// RQ 获取线环顶点字符串
    this.delPolygonByName = delPolygonByName;// RQ 删除指定多边形。
    this.delAllPolygon = delAllPolygon;// RQ 删除所有多边形。
    this.convertVertices2String = convertVertices2String;// RQ
    this.setModifyPoygon = setModifyPoygon;// RQ 激活小区业务下地图的点击事件。
    this.setClickPoygon = setClickPoygon;// RQ 多边形点击。
    this.getCurclickpointStr = getCurclickpointStr;// RQ 获取地图点击后的经纬度
    this.clearCurclickpointStr = clearCurclickpointStr;// RQ 清除地图点击后的经纬度
    this.setAddSiteMode = setAddSiteMode;
    this.setDeleteSiteMode = setDeleteSiteMode;
    this.getDeleteSiteMode = getDeleteSiteMode;
    this.setMoveSiteMode = setMoveSiteMode;
    this.getMoveSiteMode = getMoveSiteMode;
    this.editCellInfo = editCellInfo;
    this.editNewAddCellInfo = editNewAddCellInfo;
    this.setAddSiteParam = setAddSiteParam;
    this.registerAddSiteEvent = registerAddSiteEvent;
    this.addMoveSiteControl = addMoveSiteControl;
    this.moveSiteToLonlat = moveSiteToLonlat;
    this.exportAddedCellInfos = exportAddedCellInfos;
    this.exportDeletedCellInfos = exportDeletedCellInfos;
    this.addSingleCell2SelectedSite = addSingleCell2SelectedSite;
    this.setCurLayersForAddCell = setCurLayersForAddCell;
    this.deleteCellBySelectCellFeature = deleteCellBySelectCellFeature;
    this.getDeleteSiteCallBack = getDeleteSiteCallBack;
    this.isInMapExtents = isInMapExtents;
    this.getMapZoomLevel = getMapZoomLevel;
    this.getMapCenter = getMapCenter;
    this.setBoxControlMode = setBoxControlMode;
    this.stopDraw = stopDraw;
    this.clearDraw = clearDraw;
    this.lineAngleByPoint = lineAngleByPoint;
    this.setGetLonLat = setGetLonLat;
    this.getLayerVisibility = getLayerVisibility;
    this.displaySCInformation = displaySCInformation;
    this.addGridLayer = addGridLayer;
    this.cancelGridHighHight = cancelGridHighHight;
    this.isLayerExist = isLayerExist;
    this.zoomOut = zoomOut;
    this.zoomIn = zoomIn;
    this.zoomTo = zoomTo;
    this.startDrawAngle = startDrawAngle;
    this.stopDrawAngle = stopDrawAngle;
    // 刷新所有图层
    this.refreshAllLayers = refreshAllLayers;
    this.createCustomInterval = createCustomInterval;
    this.setIsProgressiveColor = setIsProgressiveColor;
    this.getIsProgressiveColor = getIsProgressiveColor;
    // 绘制用户自定义圆形,扇形,三角形
    this.drawCustomerGraph = drawCustomerGraph;
    // 绘制用户自定义直线
    this.drawCustomerLine = drawCustomerLine;
    // 删除所以已绘制的图形
    this.removeCustomerLayer = removeCustomerLayer;
    // 创建图层
    this.createCustomerLayer = createCustomerLayer;
    // 绘制用户自定义矩形
    this.drawCustomerPolygon = drawCustomerPolygon;
    // 添加拖动控件
    this.addMoveCustomerControl = addMoveCustomerControl;
    // 拖动控件回调函数
    this.activateCustomerSelectEvent = activateCustomerSelectEvent;
    // 注销拖动控件
    this.deactivateCustomerSelectEvent = deactivateCustomerSelectEvent;

    /**
     * 小区多选信息存储
     */
    this.getSelectCellInfo = getSelectCellInfo;
    this.setSelectCellInfo = setSelectCellInfo;

    // 小区多选
    this.cellSelect = cellSelect;
    this.dataJson = dataJson;
    // // 小区矩形回调
    // this.setDrawFeatureCallBack = setDrawFeatureCallBack;
    // 获取自定义图形矩形拖动之后的经纬度
    this.getMoveLonlat = getMoveLonlat;
    // PVIS定制Tips框
    this.addImagePopupByLonlat = addImagePopupByLonlat;
    // 地图MouseMouve事件
    this.getMouseMoveLonLat = getMouseMoveLonLat;
    this.calcDistanceBetweenLonLat = calcDistanceBetweenLonLat;
    // 在线已经画出来的基础上修改线宽和线的颜色
    this.changeLineAttribute = changeLineAttribute;
    // 取消已修改的线宽和线的颜色
    this.cancelLineChange = cancelLineChange;

    // 获取多边形面积
    this.getpolygonArea = getpolygonArea;
    this.areaPolygon = areaPolygon;
    // 返回鼠标是否是拖动事件标志
    this.getMouseMoveFlag = getMouseMoveFlag;
    // 设置鼠标拖动标志
    this.setMouseMoveFlag = setMouseMoveFlag;
    /** ****************外部接口************************ */

    /** ****************内部接口************************ */
    this.getCurScale = getCurScale;
    this.refreshLayerDataExtent = refreshLayerDataExtent;
    this.locateMapCenter = locateMapCenter;
    this.getRefeshingInd = getRefeshingInd;
    this.setRefeshingInd = setRefeshingInd;
    this.getSeqObj = getSeqObj;
    this.getMoveLonlat = getMoveLonlat;
    this.mapClickFunc = mapClickFunc;
    // 获取地图点击处经纬度
    this.getClickLonLat = getClickLonLat;
    // 激活拖动控件
    this.setMoveCustomerMode = setMoveCustomerMode;
    this.getIsModifyLineAttribute = getIsModifyLineAttribute;
    this.getSelectLineAttribute = getSelectLineAttribute;
    this.reSetMap = reSetMap;
    this.updateAllPopupAfterZoom = updateAllPopupAfterZoom;
    // 地图各种鼠标事件
    /** ****************内部接口************************ */

    // 外部需要访问的参数
    // 回调函数需要使用
    this.getLayermap = function() {
        return layermap;
    };
    this.getLockRefreshInd = function() {
        return lockRefreshInd;
    };
    // 插件需要使用
    this.getMapAppParmObj = function() {
        return mapAppParmObj;
    };
    this.getMapMgrObj = function() {
        return mapMgrObj;
    };

    /**
     * 通过元素id获取元素节点
     * 
     * @param elementId
     *            {String}
     */
    this.getElemnt = function(elementId) {
        return document.getElementById(elementId);
    };

};
