function MapMgr() {
    var mapObj = null;

    // 多个图层单个feature选择
    var singleSelectCtl = null;
    var singleHoverSelectCtl = null;
    // 单个图层多个feature选择
    var multiSelectCtl = null;
    // 十字线图层对象
    var crossLineLayerObj = null;
    // 测量工具对象实例
    var measureControls = null;
    // 自定义测距点图片路径
    var measurePicPath = null;
    // 添加绘制多边形对象实例
    var polygonControls = null;
    var boxControls = null;
    var lineControls = null;
    var lineTypes = null;
    var polygonLayer = null;
    var boxLayer = null;
    var lineLyer = null;
    var drawLine = null;
    // 过滤后的所有点
    var polygonVertices = null;
    var lineVertices = null;
    // 绘制多边形时，用户注册的回调函数
    var polygonCallback = null;
    var distanceCallback = null;
    // 绘制多边形的边（三边形 or 四边形 or 五边形）
    var side = 3;
    // 地图基准图层
    var baselayerobj = null;

    // 存储多选状态小区信息
    var cellInfoObj = [];
    // Navigation实例
    var navbar = null;

    // google地图的对象,避免google地图切换每次需要重建
    var googlemap = new GISHashMap();
    // bing地图的对象,避免bing地图切换每次需要重建
    var bingmap = new GISHashMap();

    // var initZoomLeverInd=false;
    // 当前的地图参数信息,用于地图切换
    var curmaptype = 0;
    var curprojection = null;
    var curunit = null;
    var curMaxZoomLever = 0;
    // 添加最小级别
    var curMinZoomLever = 0;

    // 箭头属性
    var arrowRadius = 0.5;
    var arrowAngle = 10;
    // 注册切换地图前的的中心点和层级
    var lastCenter = null;
    var lastZoomRange = null;

    // 地图坐标映射源OpenLayers.Projection对象实例,默认为4026的坐标投影
    var sourceProj = null;
    // 地图坐标映射目的OpenLayers.Projection对象实例,当地图采用非4026的坐标投影时使用
    var targetProj = null;
    // 标记地理坐标是否需要坐标投影，地图非默认的4026的坐标投影为true
    var transformInd = false;

    var polygonArea = 0;
    // 测量事件的外部信息
    // var measureResultTopDivId = '';
    // var measureResultBottomDivId = '';
    var unitMessageHashMap = new GISHashMap();

    // 工参的经纬度的坐标映射
    var DEFAULT_PROJECTION = 'EPSG:4326';

    var divIds = null;
    // 鼠标移动浮动层对象
    var popupHover = null;

    var message = null; // add by zhaoding

    var measureResultLlayer = null;

    // 手动在地图上移动站点开关，开关，值为true时进入移站模式，点击即可移动站点
    var moveSiteMode = false;
    //
    var moveCustomerMode = true;

    // Bing地图地图枚举与比例尺对应关系集合
    var bingBoomLever = new GISHashMap();
    // openStreet与Arcgis地图枚举与比例尺对应关系集合
    var commonBoomLever = new GISHashMap();
    // 谷歌地图地图枚举与比例尺对应关系集合
    var gooleBoomLever = new GISHashMap();
    // WMS地图地图枚举与比例尺对应关系集合
    var wmsBoomLever = new GISHashMap();
    // 空白地图
    var blankBoomLever = new GISHashMap();
    // OpenStreet地图
    var openStreetBoomLever = new GISHashMap();
    // ArcGis地图
    var arcGisBoomLever = new GISHashMap();
    // 调用openlayers API建立Openlayer地图根据参数建立不同类型的地图
    /*
     * 参数分别是 mapDiv：显示地图的html div ID scaleDiv: 显示比例尺的html div ID
     * positionDiv:显示鼠标经纬度的html div ID mapParmObj：地图的json参数
     * messages：经纬度标签描述和比例尺单位标签描述，用于国际化
     */
    var initMap = function(_divIds, mapParmObj, messages, culture) {
        var newMapObjInd = false;
        divIds = _divIds;
        var mapDiv = divIds.mapDiv;
        var defaultZoomLever = 0;

        var premaptype = curmaptype;
        // 添加是比例尺还是Lever
        var isLever = (typeof (mapParmObj.isLever) == "undefined") ? true
                : mapParmObj.isLever;
        if (isLever) {
            curMaxZoomLever = parseInt(mapParmObj.maxZoomLever);
            curMinZoomLever = (typeof (mapParmObj.minZoomLever) == "undefined") ? 1
                    : parseInt(mapParmObj.minZoomLever);
            defaultZoomLever = parseInt(mapParmObj.defaultZoomLever);
        } else {
            // 获取初始化地图时根据选择的地图初始化地图枚举与比例尺对应关系
            boomType = chooseBoomByMapType(mapParmObj);
            curMaxZoomLever = boomType.get(mapParmObj.maxZoomLever);
            curMinZoomLever = (typeof (mapParmObj.minZoomLever) == "undefined") ? 1
                    : boomType.get(mapParmObj.minZoomLever);
            defaultZoomLever = boomType.get(mapParmObj.defaultZoomLever);
        }
        curmaptype = parseInt(mapParmObj.type);
        curunit = mapParmObj.units;
        curprojection = mapParmObj.projection;
        var resolutions = mapParmObj.resolutions;
        if (defaultZoomLever < 0) {
            defaultZoomLever = 0;
        }

        if (mapObj != null) {
            var preBaseLayerObj = baselayerobj;
            setMap(curmaptype, mapParmObj, culture);
            preBaseLayerObj.setVisibility(false);
            mapObj.setBaseLayer(baselayerobj);
            baselayerobj.setVisibility(true);
            // if (premaptype != GisMapType.MAP_GOOGLE) {
            // mapObj.removeLayer(preBaseLayerObj);
            // }
            // 记录当前地图的当前级别
            mapParmObj.zoom = mapObj.getZoom();
        } else {
            var options = getOptions(curmaptype, mapDiv, curMaxZoomLever,
                    curprojection, curunit, resolutions);
            mapObj = new OpenLayers.Map(options);
            newMapObjInd = true;
            setMap(curmaptype, mapParmObj, culture);// add layer or layers for
            // Map
            var centerpoint = null;
            var zoomLever = 0;
            if (lastCenter == null) {
                centerpoint = new OpenLayers.LonLat(mapParmObj.centerLongitude,
                        mapParmObj.centerLatitude);
                zoomLever = defaultZoomLever;
            } else {
                centerpoint = lastCenter;
                lastCenter = null;

                zoomLever = curMaxZoomLever - lastZoomRange;
                if (zoomLever < defaultZoomLever || zoomLever > curMaxZoomLever) {
                    zoomLever = defaultZoomLever;
                }
            }

            transform(centerpoint);

            mapObj.setCenter(centerpoint, zoomLever);
            // 解决bug,多次切换地图后zoomLever失效
            if (mapObj.getZoom() < zoomLever) {
                mapObj.setCenter(centerpoint, zoomLever);
            }
            // 记录当前地图的当前级别
            mapParmObj.zoom = zoomLever;
            dataMapExtent = null;
        }

        // 设置地图的最大、最小级别，用于控制使用+-控件达到最大最小级别时不再刷新
        if (mapObj != null) {
            mapObj.maxZoomLevel = curMaxZoomLever;
            mapObj.minZoomLevel = curMinZoomLever;
        }
        setControls(divIds, messages, mapParmObj);// add Controls for Map
        crossLineLayer();

        return newMapObjInd;
    };

    /**
     * 添加比例尺和ZoomLevel控件
     */
    var addScaleLineAndZoomLevelCtr = function(divIds, messages, mapParmObj) {
        var scaleLineControl = null;
        var scaleDiv = divIds.scaleDiv;
        var topOutUnitVal = messages.km; // 公里
        var topInUnitVal = messages.m; // 米
        var bottomOutUnitVal = messages.mi; // 英里
        var bottomInUnitVal = messages.ft; // 英尺
        if (topOutUnitVal != 'km') {
            OpenLayers.INCHES_PER_UNIT[topOutUnitVal] = OpenLayers.INCHES_PER_UNIT['km'];
            OpenLayers.INCHES_PER_UNIT[topInUnitVal] = OpenLayers.INCHES_PER_UNIT['m'];
            OpenLayers.INCHES_PER_UNIT[bottomOutUnitVal] = OpenLayers.INCHES_PER_UNIT['mi'];
            OpenLayers.INCHES_PER_UNIT[bottomInUnitVal] = OpenLayers.INCHES_PER_UNIT['ft'];
        }
        scaleLineControl = new OpenLayers.Control.ScaleLine({
            div : document.getElementById(scaleDiv),
            'maxWidth' : 190,
            topOutUnits : topOutUnitVal,
            topInUnits : topInUnitVal,
            bottomOutUnits : bottomOutUnitVal,
            bottomInUnits : bottomInUnitVal
        });
        mapObj.addControl(scaleLineControl);

        // 显示当前地图缩放级别
        var isShowZoomLevel = (typeof (mapParmObj.isShowZoomLevel) == "undefined") ? false
                : mapParmObj.isShowZoomLevel;

        var customScaleDiv = scaleDiv != null && typeof scaleDiv != 'undefined'
                && scaleDiv != '';
        if (isShowZoomLevel) {
            mapObj.addControl(new OpenLayers.Control.ZoomLevelBox());
            if (!customScaleDiv) {
                scaleLineControl.div.style.left = "55%";
                scaleLineControl.div.style.bottom = "15px";
            }
        } else if (!customScaleDiv) {
            scaleLineControl.div.style.right = "3px";
        }
    };

    // 内部函数:初始化地图的子函数,根据地图类型初始化openlayer地图图层对象
    var setMap = function(maptype, mapParmObj, culture) {
        var title = mapParmObj.title;
        var layername = mapParmObj.layer;
        var mapurl = mapParmObj.url;
        var maxZoomLever = 0;
        var minZoomLever = 0;
        var isLever = (typeof (mapParmObj.isLever) == "undefined") ? true
                : mapParmObj.isLever;
        // 添加地图枚举或Lever判断
        if (isLever) {
            maxZoomLever = parseInt(mapParmObj.maxZoomLever);
            minZoomLever = (typeof (mapParmObj.minZoomLever) == "undefined") ? 1
                    : parseInt(mapParmObj.minZoomLever);
        } else {
            boomType = chooseBoomByMapType(mapParmObj);
            maxZoomLever = boomType.get(mapParmObj.maxZoomLever);
            minZoomLever = (typeof (mapParmObj.minZoomLever) == "undefined") ? 1
                    : boomType.get(mapParmObj.minZoomLever);
        }
        if (maptype == GisMapType.MAP_WMS) {
            initWMS(layername, title, mapurl);
        } else if (maptype == GisMapType.MAP_ARCGIS_REST) {
            initArcGISRest(layername, title, mapurl);
        } else if (maptype == GisMapType.MAP_ARCGIS_IMS) {
            initArcGISIms(layername, title, mapurl);
        } else if (maptype == GisMapType.MAP_ARCGIS_CACHE) {
            initArcGISCache(layername, title, mapurl);
        } else if (maptype == GisMapType.MAP_XYZ) {
            initXYZMap(layername, title, mapurl, maxZoomLever);
        } else if (maptype == GisMapType.MAP_GOOGLE) {
            try {
                initGoogle(layername, maxZoomLever);
            } catch (e) {
                e.name = InitGoogleMapError;
                throw e;
            }
        } else if (maptype == GisMapType.MAP_BING) {
            try {
                initBing(layername, mapurl, maxZoomLever, culture);
            } catch (e) {
                e.name = InitBingMapError;
                throw e;
            }
        } else if (maptype == GisMapType.MAP_OPENSTREET) {
            try {
                initOSM(mapurl, maxZoomLever);
            } catch (e) {
                e.name = InitOpenStreetMapError;
                throw e;
            }

        } else if (maptype == GisMapType.MAP_SOGO) {
            initSoGoMap(mapurl, maxZoomLever);
        } else {
            mapObj.allOverlays = true;
            var options = {
                styleMap : new OpenLayers.StyleMap({
                    'default' : new OpenLayers.Style({
                        cursor : 'move'
                    }),
                    'temporary' : new OpenLayers.Style({
                        cursor : 'move'
                    }),
                    'select' : new OpenLayers.Style({
                        cursor : 'move'
                    })
                }),
                numZoomLevels : maxZoomLever,
                displayInLayerSwitcher : false
            };
            baselayerobj = new OpenLayers.Layer.Vector(title, options);
            baselayerobj.div.style.cursor = 'move';
            mapObj.addLayer(baselayerobj);
        }

        if (mapParmObj.panDuration) {
            mapObj.panDuration = mapParmObj.panDuration;
        } else {
            mapObj.panDuration = 10;
        }
    };

    /**
     * 经纬度数值转换为度分秒格式
     */
    var convertDMS = function(lonLat, type, digits) {
        var convertedLonLat = '';
        // 经纬度取绝对值
        var absLonLat = Math.abs(lonLat);
        if (digits != null) {
            absLonLat = absLonLat.toFixed(digits);
        }
        // 度
        var degree = Math.floor(absLonLat);
        // 分
        var minute = Math.floor((absLonLat - degree) * 60);
        // 秒
        var second = Number(((absLonLat - degree) * 60 - minute) * 60).toFixed(
                2);
        // 东西经、南北纬后缀
        var suffix = '';
        if ('LON' == type) {
            if (lonLat >= 0) {
                suffix = 'E';
            } else {
                suffix = 'W';
            }
        } else if ('LAT' == type) {
            if (lonLat >= 0) {
                suffix = 'N';
            } else {
                suffix = 'S';
            }
        }
        convertedLonLat = degree + '°' + minute + '′' + second + '″' + suffix;
        return convertedLonLat;
    };

    // 内部函数:初始化地图的子函数,初始化openlayer控件对象
    var setControls = function(divIds, messages, mapParmObj)// lonlatTitles,scaleUnits)
    {
        // 删除所有的Control
        // while(mapObj.controls.length > 0){
        // mapObj.controls[0].deactivate();
        // mapObj.removeControl(mapObj.controls[0]);
        // }
        for (var i = mapObj.controls.length - 1; i >= 0; i--) {
            var isWMSGetFeatureInfoCtl = mapObj.controls[i] instanceof OpenLayers.Control.WMSGetFeatureInfo;
            var isSelectCtl = mapObj.controls[i] instanceof OpenLayers.Control.SelectFeature;
            if (isWMSGetFeatureInfoCtl || isSelectCtl) {
                continue;
            }
            mapObj.controls[i].deactivate();
            mapObj.removeControl(mapObj.controls[i]);
        }

        // 添加放大缩小控件
        navbar = new OpenLayers.Control.MouseZoomSpecific(mapParmObj);

        var positionDiv = divIds.positionDiv;
        mousePosition = new OpenLayers.Control.MousePosition(
                {
                    div : document.getElementById(positionDiv),
                    numDigits : 4,
                    formatOutput : function(lonLat) {
                        if (lonLat.lon > LonLatRange.MaxLon
                                || lonLat.lon < LonLatRange.MinLon
                                || lonLat.lat > LonLatRange.MaxLat
                                || lonLat.lat < LonLatRange.MinLat) {
                            if (globalGisCulture == 'en') {
                                return GlobalMessages_en.MousePosition_OutOfMap;
                            } else {
                                return GlobalMessages_zh.MousePosition_OutOfMap;
                            }
                        }
                        var lonInfo = null;
                        var latInfo = null;
                        var isDMSLonLat = (typeof (mapParmObj.isDMSLonLat) == "undefined") ? true
                                : mapParmObj.isDMSLonLat;
                        if (isDMSLonLat) {
                            lonInfo = convertDMS(lonLat.lon, 'LON',
                                    this.numDigits);
                            latInfo = convertDMS(lonLat.lat, 'LAT',
                                    this.numDigits);
                        } else {
                            lonInfo = lonLat.lon;
                            latInfo = lonLat.lat;
                        }
                        var info = messages.longitude + ': ' + lonInfo;
                        info += ' &nbsp;&nbsp;' + messages.latitude + ': '
                                + latInfo;
                        return info;
                    }
                });
        var zoomBar;
        if (mapParmObj.scaleBar == 'minBar') {
            zoomBar = new OpenLayers.Control.Zoom;
            mapObj.addControls([zoomBar]);
        } else if (mapParmObj.scaleBar == '') {

        } else {
            zoomBar = new OpenLayers.Control.PanZoomBar;
            mapObj.addControls([zoomBar]);
        }
        if (mapParmObj.layerManager == 'open') {
            mapObj.addControls([new OpenLayers.Control.LayerSwitcher({
                'ascending' : false,
                'roundeCorner' : true
            // 是否显示为圆角
            })]);
        }
        // 显示鸟瞰图
        var isShowOverViewMap = (typeof (mapParmObj.isShowOverViewMap) == "undefined") ? false
                : mapParmObj.isShowOverViewMap;

        mapObj.addControls([navbar,
        // new OpenLayers.Control.Permalink(),
        mousePosition
        // new OpenLayers.Control.KeyboardDefaults()
        ]);

        if (mapParmObj.type != 0 && isShowOverViewMap) {
            mapObj.addControl(new OpenLayers.Control.LTOverviewMap());
        }

        addScaleLineAndZoomLevelCtr(divIds, messages, mapParmObj);
        addMeasurementControl(divIds, messages, mapParmObj);
        addPolygonControl(divIds);
        addLineControl();
        lineType();
        addBoxControl();

    };

    // 内部函数:判断地图坐标影射类型是否为默认类型
    var isDefaultProjection = function(projection) {
        var result = true;
        if (projection != DEFAULT_PROJECTION) {
            result = false;
        }
        return result;
    };

    // 内部函数:初始化地图的子函数,生成openlayer地图参数
    var getOptions = function(maptype, mapDiv, maxZoomLever, projection, units,
            resolutions) {
        var options = {
            units : units,
            div : mapDiv,
            allOverlays : false,
            minResolution : 'auto',
            isBaseLayer : true,
            controls : []
        };

        // if (maptype == GisMapType.MAP_GOOGLE) {
        // options.minZoomLevel = 3;
        // }
        // if (maptype == GisMapType.MAP_BING) {
        // options.maxResolution = 156543.03390625;
        // options.minZoomLevel = 1;
        // }

        var defaltProjInd = isDefaultProjection(projection);
        if (!defaltProjInd) {
            targetProj = new OpenLayers.Projection(projection);
            sourceProj = new OpenLayers.Projection(DEFAULT_PROJECTION);
            transformInd = true;
            options.projection = targetProj;
            options.displayProjection = sourceProj;
        }
        if (maptype > 10) {
            var resolutionArry = splitParms(resolutions);
            if (resolutionArry.length == 0) {
                options.numZoomLevels = maxZoomLever;
                if (defaltProjInd) {
                    var maxResolutionLimit = 1.40625 / Math.pow(2, 3);
                    options.maxResolution = maxResolutionLimit;
                }
            } else {
                options.resolutions = resolutionArry;
            }
        }
        return options;
    };

    // 内部函数:建立WMS地图
    var initWMS = function(layername, title, mapurl) {
        mapObj.allOverlays = false;
        baselayerobj = new OpenLayers.Layer.WMS(title, mapurl, {
            layers : layername
        });
        mapObj.addLayer(baselayerobj);
    };
    // 内部函数:建立ArcGis Rest地图
    var initArcGISRest = function(layername, title, mapurl) {
        baselayerobj = new OpenLayers.Layer.ArcGIS93Rest(title, mapurl, {
            layers : layername
        });
        mapObj.addLayer(baselayerobj);
    };
    // 内部函数:建立ArcGis IMS地图
    var initArcGISIms = function(layername, title, mapurl) {
        baselayerobj = new OpenLayers.Layer.ArcIMS(title, mapurl, {
            serviceName : layername
        });
        mapObj.addLayer(baselayerobj);
    };

    // 内部函数:分割地图链接函数, mapurl允许多个链接,各个链接之间采用;号分割
    var splitParms = function(parms) {
        var parmResult = '';
        if (parms != null) {
            var parmArray = parms.split(';');
            if (parmArray.length > 1) {
                parmResult = parmArray;
            }
        }
        if (parmResult == '' && parms != null) {
            parmResult = parms;
        }
        return parmResult;
    };

    // 内部函数:分割地图链接函数,http://[abc].tile2.opencyclemap.org/transport/${z}/${x}/${y}.png
    var splitURLParms = function(parms) {
        var parmResult = '';
        if (parms != null) {
            var idxStart = parms.indexOf('[');
            var idxEnd = parms.indexOf(']');
            if (idxStart > 0 && idxEnd > idxStart) {
                var strStart = parms.substr(0, idxStart);
                var strVar = parms.substr(idxStart + 1, idxEnd - idxStart - 1);
                var strEnd = parms.substr(idxEnd + 1);
                for (var i = 0; i < strVar.length; i++) {
                    if (i != 0) {
                        parmResult = parmResult + ';';
                    }
                    parmResult = parmResult + strStart + strVar.charAt(i)
                            + strEnd;
                }
            }
        }
        if (parmResult == '') {
            parmResult = splitParms(parms);
        } else {
            parmResult = splitParms(parmResult);
        }
        return parmResult;
    };

    // 内部函数:建立XYZ spherical mercator地图,mapurl允许多个链接,各个链接之间采用;号分割
    var initXYZMap = function(layername, title, mapurl, maxZoom) {
        var urls = splitURLParms(mapurl);
        baselayerobj = new OpenLayers.Layer.XYZ(title, urls, {
            // sphericalMercator : true,
            numZoomLevels : maxZoom
        });
        mapObj.addLayer(baselayerobj);
    };

    // 内部函数:建立ArcGis Cache地图
    var initArcGISCache = function(layername, title, mapurl) {
        // TODO: 搞清楚tileOrigin为什么不能用通过中心点来替换.
        baselayerobj = new OpenLayers.Layer.ArcGISCache(title, mapurl, {
            // tileSize: new OpenLayers.Size(256, 256),
            tileOrigin : new OpenLayers.LonLat(-20037508.342787,
                    20037508.342787)
        // ,
        // projection: 'EPSG:102100'
        });
        mapObj.addLayer(baselayerobj);
    };
    // 内部函数:建立OpenStreetMap
    var initOSM = function(mapurl, maxZoom) {
        if (mapurl != null && mapurl != '') {
            var urls = splitURLParms(mapurl);
            baselayerobj = new OpenLayers.Layer.OSM('OpenStreet', urls);
        } else {
            baselayerobj = new OpenLayers.Layer.OSM('OpenStreet');
        }
        mapObj.addLayer(baselayerobj);
    };

    // 内部函数:建立Google地图
    var initSoGoMap = function(mapurl, maxZoomLever) {
        var urls = splitURLParms(mapurl);
        var baselayerobj = new OpenLayers.Layer.SoGou('SoGou', urls, {
            numZoomLevels : maxZoomLever
        });
        mapObj.addLayer(baselayerobj);
        mapObj.setBaseLayer(baselayerobj);

    };

    // 内部函数:建立BingMap
    var initBing = function(layername, apiKey, maxZoomLever, culture) {
        if (bingmap.size() == 0) {
            var road = new OpenLayers.Layer.Bing({
                name : 'Road',
                key : apiKey,
                type : 'Road',
                numZoomLevels : maxZoomLever,
                culture : 'en-US'
            });
            var hybrid = new OpenLayers.Layer.Bing({
                name : 'Hybrid',
                key : apiKey,
                type : 'AerialWithLabels',
                numZoomLevels : maxZoomLever,
                culture : 'zh-Hans'
            });
            var aerial = new OpenLayers.Layer.Bing({
                name : 'Aerial',
                key : apiKey,
                type : 'Aerial',
                numZoomLevels : maxZoomLever,
                culture : 'zh-Hans'
            });
            mapObj.addLayers([road, hybrid, aerial]);
            bingmap.put('Road', road);
            bingmap.put('Hybrid', hybrid);
            bingmap.put('Aerial', aerial);
        }
        baselayerobj = bingmap.get(layername);
        mapObj.setBaseLayer(baselayerobj);
    };

    // 内部函数:建立Google地图
    var initGoogle = function(layername, maxZoomLever) {
        if (googlemap.size() == 0) {
            var gphy = new OpenLayers.Layer.Google('Google Physical', {
                type : google.maps.MapTypeId.TERRAIN,
                numZoomLevels : maxZoomLever
            });
            var gmap = new OpenLayers.Layer.Google('Google Streets',
            // the default
            {
                type : google.maps.MapTypeId.ROADMAP,
                numZoomLevels : maxZoomLever
            }

            );
            var ghyb = new OpenLayers.Layer.Google('Google Hybrid', {
                type : google.maps.MapTypeId.HYBRID,
                numZoomLevels : maxZoomLever
            });
            var gsat = new OpenLayers.Layer.Google('Google Satellite', {
                type : google.maps.MapTypeId.SATELLITE,
                numZoomLevels : maxZoomLever
            });

            mapObj.addLayers([gphy, gmap, ghyb, gsat]);
            googlemap.put('google.maps.MapTypeId.TERRAIN', gphy);
            googlemap.put('google.maps.MapTypeId.ROADMAP', gmap);
            googlemap.put('google.maps.MapTypeId.HYBRID', ghyb);
            googlemap.put('google.maps.MapTypeId.SATELLITE', gsat);
        }
        baselayerobj = googlemap.get(layername);
        mapObj.setBaseLayer(baselayerobj);
    };

    // 切换地图是判断地图是否兼容,如果不兼容,需要重建地图
    /**
     * 参数：newprojection：坐标投影 newUnit:地图单位
     */
    var isCompatibility = function(newprojection, newUnit) {
        var result = false;
        if (mapObj != null) {
            if (curprojection == newprojection && curunit == newUnit) {
                result = true;
            }
        }
        return result;

    };

    /**
     * 强制重置地图，给gisMap调用，不判断地图兼容性
     */
    var forceToResetMap = function() {
        lastZoomRange = null;
        lastCenter = null;
        reSetMap();
    };

    // 外部类：切换地图时需要重建地图时,用于内存变量销毁和内部参数传递
    var terminate = function(mapParmObj) {
        var compatibilityInd = isCompatibility(mapParmObj.projection,
                mapParmObj.units);
        if (!compatibilityInd) {
            if (null != mapObj) {
                lastZoomRange = curMaxZoomLever - mapObj.getZoom();
                lastCenter = mapObj.getCenter();
                if (!isDefaultProjection(curprojection)) {
                    reTransform(lastCenter);
                }
            }
            // 重置地图
            reSetMap();
        } else {
            lastZoomRange = null;
            lastCenter = null;
        }
        return compatibilityInd;
    };
    var reSetMap = function() {
        mapObj = null;
        transformInd = false;
        baselayerobj = null;
        measureControls = null;
        polygonControls = null;
        boxControls = null;
        lineControls = null;
        lineTypes = null;
        crossLineLayerObj = null;
        polygonLayer = null;
        lineLyer = null;
        measureResultLlayer = null;
        singleSelectCtl = null;
        singleHoverSelectCtl = null;
        multiSelectCtl = null;
        googlemap.clear();
        bingmap.clear();

        var divObj = document.getElementById(divIds.mapDiv);
        if (divObj != null) {
            divObj.innerHTML = '';
            divObj = null;
        }

        divObj = document.getElementById(divIds.scaleDiv);
        if (divObj != null) {
            divObj.innerHTML = '';
            divObj = null;
        }

    };

    /**
     * 十字线图层创建
     */
    var crossLineLayer = function() {
        if (crossLineLayerObj != null) {
            mapObj.removeLayer(crossLineLayerObj);
        }
        var options = {
            styleMap : new OpenLayers.StyleMap({
                'default' : new OpenLayers.Style({
                    strokeWidth : 1,
                    fillColor : '#505D4D'
                })
            }),
            displayInLayerSwitcher : false
        };
        crossLineLayerObj = new OpenLayers.Layer.Vector('crossPoint', options);
        mapObj.addLayer(crossLineLayerObj);
    };

    /**
     * 添加区域过滤控件
     */
    var addPolygonControl = function(divIds) {
        if (polygonControls == null) {
            // 创建过滤的图层
            polygonLayer = new OpenLayers.Layer.Vector('polygonLayer', {
                displayInLayerSwitcher : false
            });
            polygonLayer.style = {
                fillOpacity : 0.3,
                fillColor : '#31b1d1',
                strokeColor : '#31b1d1',
                strokeOpacity : 1.0,
                strokeWidth : 2
            /*
             * , strokeDashstyle: "dash"
             */
            };
            // 添加绘制多边形控制层
            polygonControls = new OpenLayers.Control.DrawFeature(polygonLayer,
                    OpenLayers.Handler.Polygon);
            polygonControls.featureAdded = onFeatureAdded;
            mapObj.addLayer(polygonLayer);
            mapObj.addControl(polygonControls);
        }
    };

    /**
     * 添加矩形绘制控件
     */
    var addBoxControl = function() {
        if (boxControls == null) {
            // 创建过滤的图层
            boxLayer = new OpenLayers.Layer.Vector('boxLayer', {
                displayInLayerSwitcher : false
            });
            boxLayer.style = {
                fillOpacity : 0.6,
                fillColor : '#FFFFFF',
                strokeColor : '#FFFFFF',
                strokeOpacity : 1.0,
                strokeWidth : 2
            };
            // 添加绘制多边形控制层
            boxControls = new OpenLayers.Control.DrawFeature(boxLayer,
                    OpenLayers.Handler.RegularPolygon, {
                        handlerOptions : {
                            sides : side,
                            irregular : true
                        }
                    });
            // 回调
            // if(null != clickCallBack){
            // boxControls.featureAdded = clickCallBack;
            // }
            mapObj.addLayer(boxLayer);
            mapObj.addControl(boxControls);
        }
    };

    var addLineControl = function() {
        if (lineControls == null) {
            // 创建过滤的图层
            lineLyer = new OpenLayers.Layer.Vector('lineLayer', {
                displayInLayerSwitcher : false
            });
            lineLyer.style = {
                fillOpacity : 0.6,
                fillColor : '#FFFFFF',
                strokeColor : '#FFFFFF',
                strokeOpacity : 1.0,
                strokeWidth : 3,
                strokeDashstyle : 'solid'
            };
            // 添加绘制多边形控制层
            lineControls = new OpenLayers.Control.DrawFeature(lineLyer,
                    OpenLayers.Handler.Path);
            lineControls.featureAdded = onLineFeatureAdded;
            mapObj.addLayer(lineLyer);
            mapObj.addControl(lineControls);
        }
    };

    var lineType = function() {
        // var pointArr = [];
        // var itemPolygon = null;
        // // 添加划线逻辑
        // if (isArrow) {
        // pointArr = getLineArrow(tempBasePoint, tempNeiPoint);
        // itemPolygon = new OpenLayers.Geometry.Polygon([new
        // OpenLayers.Geometry.LinearRing(pointArr)]);
        // }
        // var itemVec = new OpenLayers.Feature.Vector(new
        // OpenLayers.Geometry.Collection([itemPolygon]));
        if (lineTypes == null) {
            // 创建过滤的图层
            drawLine = new OpenLayers.Layer.Vector('drawLine', {
                displayInLayerSwitcher : false
            });
            drawLine.style = {
                fillOpacity : 0.6,
                fillColor : '#FFFFFF',
                strokeColor : '#FF44FF',
                strokeOpacity : 1.0,
                strokeWidth : 2,
                strokeDashstyle : 'solid'
            };

            // 添加绘制控制层
            lineTypes = new OpenLayers.Control.DrawFeature(drawLine,
                    OpenLayers.Handler.Path);
            lineTypes.featureAdded = onLineDrawFeature;
            mapObj.addLayer(drawLine);
            mapObj.addControl(lineTypes);
            // mapObj.addFeatures(itemVec);
        }
    };
    /**
     * 画线的箭头 basePoint 画箭头的点 neiPoint 距离画箭头最近的点
     */
    var getLineArrow = function(basePoint, neiPoint) {
        var points = [];
        var x1, x2, y1, y2, ro, angle;
        var a = basePoint.x, b = basePoint.y, c = neiPoint.x, d = neiPoint.y;
        var resolution = mapObj.baseLayer.getResolution();
        var maxResolution = mapAppParmObj.mapType == 3 ? mapObj.baseLayer.maxResolution * 2
                : mapObj.baseLayer.maxResolution;
        var rate = resolution / maxResolution;
        // 对于球体地图来说，maxResolution=156543.03390625, google地图去掉最小的三级。
        if (maxResolution < 156543) {
            rate = rate / 8;
        }
        if (rate != 1) {
            rate = rate * mapAppParmObj.adjustRate;
        }
        if (rate > 1) {
            rate = 1;
        }
        var finalRadius = rate * 20 * arrowRadius;
        ro = (d - b) / (c - a);
        angle = Math.atan(ro);
        if (d >= b && c >= a) {
            x1 = a - finalRadius * Math.cos(angle + arrowRadius);
            y1 = b - finalRadius * Math.sin(angle + arrowRadius);
            points.push(new OpenLayers.Geometry.Point(x1, y1));
            x2 = a - finalRadius * Math.cos(angle - arrowRadius);
            y2 = b - finalRadius * Math.sin(angle - arrowRadius);
            points.push(new OpenLayers.Geometry.Point(x2, y2));
        } else if (d >= b && c < a) {
            x1 = a + finalRadius * Math.cos(angle + arrowRadius);
            y1 = b + finalRadius * Math.sin(angle + arrowRadius);
            points.push(new OpenLayers.Geometry.Point(x1, y1));
            x2 = a + finalRadius * Math.cos(angle - arrowRadius);
            y2 = b + finalRadius * Math.sin(angle - arrowRadius);
            points.push(new OpenLayers.Geometry.Point(x2, y2));
        } else if (d < b && c <= a) {
            x1 = a + finalRadius * Math.cos(angle + arrowRadius);
            y1 = b + finalRadius * Math.sin(angle + arrowRadius);
            points.push(new OpenLayers.Geometry.Point(x1, y1));
            x2 = a + finalRadius * Math.cos(angle - arrowRadius);
            y2 = b + finalRadius * Math.sin(angle - arrowRadius);
            points.push(new OpenLayers.Geometry.Point(x2, y2));
        } else if (d < b && c >= a) {
            x1 = a - finalRadius * Math.cos(angle + arrowRadius);
            y1 = b - finalRadius * Math.sin(angle + arrowRadius);
            points.push(new OpenLayers.Geometry.Point(x1, y1));
            x2 = a - finalRadius * Math.cos(angle - arrowRadius);
            y2 = b - finalRadius * Math.sin(angle - arrowRadius);
            points.push(new OpenLayers.Geometry.Point(x2, y2));
        }
        points.push(basePoint);
        return points;
    };
    /**
     * 返回区域过滤的所有点集合
     */
    var getPolygonControlPointStr = function() {
        if (polygonVertices) {
            var pointStr = convertVertices2String(polygonVertices);
            removeFilterMarker();
            return pointStr;
        }
        return '';
    };

    /**
     * 返回线顶点集合。
     * 
     * @return {String}
     */
    var getLineControlPointStr = function() {
        if (lineVertices) {
            var pointStr = convertVertices2String(lineVertices);
            removeLineFilterMarker();
            return pointStr;
        }
        return '';
    };

    /**
     * 将多边形顶点坐标信息转换成字符串形式
     */
    var convertVertices2String = function(points) {
        var pointStr = '';
        if (points && points.length) {
            for (var n = 0; n < points.length; n++) {
                reTransform(points[n]);
                pointStr += points[n].x;
                pointStr += ',';
                pointStr += points[n].y;
                pointStr += ';';
            }
        }
        return pointStr;
    };
    var convertVertices2StringNo = function(points) {
        var pointStr = '';
        if (points && points.length) {
            for (var n = 0; n < points.length; n++) {
                pointStr += points[n].x;
                pointStr += ',';
                pointStr += points[n].y;
                pointStr += ';';
            }
        }
        return pointStr;
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
        if (mode) {
            polygonControls.activate();
            polygonCallback = callbackFun;
        } else {
            removeFilterMarker();
            if (polygonControls) {
                polygonControls.deactivate();
            }
        }
    };

    /**
     * 停止绘制所有图形（包括多边形和三角形矩形圆形）
     */
    var stopDraw = function() {
        if (polygonControls) {
            polygonControls.deactivate();
        }
        if (boxControls) {
            boxControls.deactivate();
        }
    };

    /**
     * 清除所有图形
     */
    var clearDraw = function() {
        removeFilterMarker();
        removeBoxFilterMarker();
    };

    /**
     * 设置矩形三角形绘制控件.
     * 
     * @param {boolean}
     *            mode; true : 激活矩形绘制控件、false : 关闭矩形绘制控件
     * @param {Function}
     *            callbackFun 用户注册回调函数,参数为多边形顶点字符串
     */
    var setBoxControlMode = function(mode, numberOfEdges) {
        if (mode) {
            boxControls.handler.sides = numberOfEdges;
            boxControls.activate();
        } else {
            if (boxControls) {
                boxControls.deactivate();
            }
        }
    };

    /**
     * 激活画线控件。
     * 
     * @param {boolean}
     *            mode
     * @param {Function}
     *            calDistanceCallback
     * 
     */
    var setLineControlMode = function(mode, calDistanceCallback) {
        if (mode) {
            lineControls.activate();
            distanceCallback = calDistanceCallback;
        } else {
            removeLineFilterMarker();
            if (lineControls) {
                lineControls.deactivate();
            }
        }
    };

    /**
     * 绘制直线 2014-3-5 wwx174687
     * 
     * @param {boolean}
     *            mode
     */
    var setLineActivities = function(mode, layerParam) {

        if (mode) {
            drawLine.style = {
                fillOpacity : 0.6,
                fillColor : '#FFFFFF',
                strokeColor : layerParam.strokeColor,
                strokeOpacity : 1.0,
                strokeWidth : 2,
                strokeDashstyle : layerParam.lineDashstyle
            };
            mapObj.addLayer(drawLine);
            lineTypes.activate();
        } else {
            lineTypes.deactivate();
        }
    };

    /**
     * 删除区域过滤的边框
     */
    var removeFilterMarker = function() {
        if (polygonLayer) {
            polygonLayer.removeAllFeatures();
            polygonVertices = null;
        }
    };

    /**
     * 删除区域过滤的边框
     */
    var removeBoxFilterMarker = function() {
        if (boxLayer) {
            boxLayer.removeAllFeatures();
        }
    };

    /**
     * 删除图层上的线
     */
    var removeLineFilterMarker = function() {
        if (lineLyer) {
            lineLyer.removeAllFeatures({
                silent : true
            });
            lineVertices = null;
        }
    };

    /**
     * 删除线
     */
    var removeDrawLine = function() {
        if (drawLine) {
            drawLine.removeAllFeatures();
        }
    };

    /**
     * 画完多边形后判断所画多边形是否有重叠，若重叠则提示重画
     */
    var onFeatureAdded = function(feature) {
        // 获取多边形所有顶点
        var points = feature.geometry.getVertices();
        var len = points.length;
        points[len] = points[0];
        for (var i = 0; i < len - 1; i++) {
            for (var j = i + 1; j < len; j++) {
                // 判断多边形的边是否有交叉的
                if (isIntersection(points[i], points[i + 1], points[j],
                        points[j + 1])) {
                    GisUtils.customAlert();
                    if (polygonLayer) {
                        polygonLayer.removeFeatures(feature);
                    }
                    return;
                }
            }
        }
        polygonControls.deactivate();
        // 保存顶点坐标
        polygonVertices = feature.geometry.getVertices();
        /*
         * 调用用户注册回调函数
         */
        if (polygonCallback != null && typeof (polygonCallback) == 'function'
                && typeof (polygonCallback) != 'undefined') {
            polygonCallback(convertVertices2String(polygonVertices));
        }
        // polygonLayer.setZIndex(500);
    };

    /**
     * 判断多边形是否有交叉。
     * 
     * @param {Array}
     *            points 多边形顶点
     */
    var judgePolygonIsCross = function(points) {
        var len = points.length;
        points[len] = points[0];
        for (var i = 0; i < len - 1; i++) {
            for (var j = i + 1; j < len; j++) {
                // 判断多边形的边是否有交叉的
                if (isIntersection(points[i], points[i + 1], points[j],
                        points[j + 1])) {
                    return true;
                }
            }
        }
        return false;
    };

    var onLineFeatureAdded = function(feature) {
        if (lineVertices != null) {
            lineVertices = null;
        }

        lineVertices = feature.geometry.getVertices();
        lineControls.deactivate();
        if (distanceCallback != null && typeof (distanceCallback) == 'function'
                && typeof (distanceCallback) != 'undefined') {
            distanceCallback(convertVertices2String(lineVertices));
        }
    };

    var onLineDrawFeature = function(feature) {
        lineTypes.deactivate();
    };

    /**
     * 判断线段ab与线段cd是否相交，两线段重叠或交点为顶点视为不相交
     */
    var isIntersection = function(a, b, c, d) {
        var flag = false;
        if (a == c && b == d) {
            return flag;
        }
        if (b == c) {
            return flag;
        }
        if ((b.y - a.y) * (c.x - d.x) - (b.x - a.x) * (c.y - d.y) == 0) {
            return flag;
        }
        var intersection = new OpenLayers.Geometry.Point();
        intersection.x = ((b.x - a.x) * (c.x - d.x) * (c.y - a.y) - c.x
                * (b.x - a.x) * (c.y - d.y) + a.x * (b.y - a.y) * (c.x - d.x))
                / ((b.y - a.y) * (c.x - d.x) - (b.x - a.x) * (c.y - d.y));
        intersection.y = ((b.y - a.y) * (c.y - d.y) * (c.x - a.x) - c.y
                * (b.y - a.y) * (c.x - d.x) + a.y * (b.x - a.x) * (c.y - d.y))
                / ((b.x - a.x) * (c.y - d.y) - (b.y - a.y) * (c.x - d.x));

        if ((intersection.x - a.x) * (intersection.x - b.x) < 0
                && (intersection.x - c.x) * (intersection.x - d.x) < 0
                && (intersection.y - a.y) * (intersection.y - b.y) < 0
                && (intersection.y - c.y) * (intersection.y - d.y) < 0) {
            flag = true; // '相交 否则'相交但不在线段上
        }
        return flag;
    };

    // 函数,添加 测量控件
    var addMeasurementControl = function(divIds, messages, mapParmObj) {
        var mapDivId = divIds.mapDiv;
        if (measureControls == null) {
            flag = 0;
            // measureResultTopDivId = divIds.measureResultTopDiv;
            // measureResultBottomDivId = divIds.measureResultBottomDiv;
            unitMessageHashMap.put('m', messages.m);
            unitMessageHashMap.put('mi', messages.mi);
            unitMessageHashMap.put('km', messages.km);
            unitMessageHashMap.put('ft', messages.ft);

            var sketchSymbolizerStyle = {
                'Point' : {
                    pointRadius : 4,
                    graphicName : 'circle',
                    fillColor : 'white',
                    fillOpacity : 1,
                    strokeWidth : 1,
                    strokeOpacity : 1,
                    strokeColor : mapParmObj.measurementColor
                },
                'Line' : {
                    strokeWidth : 5,
                    strokeOpacity : 1,
                    strokeColor : mapParmObj.measurementColor,
                    strokeLinecap : 'round',
                    cursor : 'move'
                }
            };

            var style = new OpenLayers.Style();
            style.addRules([new OpenLayers.Rule({
                symbolizer : sketchSymbolizerStyle
            })]);
            var styleMap = new OpenLayers.StyleMap({
                'default' : style
            });

            measureControls = {
                line : new OpenLayers.Control.Measure(OpenLayers.Handler.Path,
                        {
                            persist : true,
                            handlerOptions : {
                                layerOptions : {
                                    // renderers : ['SVG', 'Canvas'],
                                    styleMap : styleMap
                                }
                            }
                        }, mapDivId),
                polygon : new OpenLayers.Control.Measure(
                        OpenLayers.Handler.Polygon, {
                            persist : true,
                            handlerOptions : {
                                layerOptions : {
                                    // renderers : ['SVG', 'Canvas'],
                                    styleMap : styleMap
                                }
                            }
                        }, mapDivId)
            };

            var control;
            for ( var key in measureControls) {
                control = measureControls[key];
                control.events.on({
                    'measure' : handleMeasurements,
                    'measurepartial' : handleMeasurements
                });
                control.geodesic = true; // use geodesic measures
                if (messages.isSupportMI) { // 支持英里单位
                    control.displaySystem = 'english';
                }
                control.setImmediate(true); // use immediate measures
                mapObj.addControl(control);
            }
        }
        message = messages;
    };

    var handleMeasurements = function(event) {
        // var geometry = event.geometry;
        var topUnit = event.units;
        var order = event.order;
        var topMeasure = event.measure;

        // 初始bottom单位和换算率
        var bottomUnit = 'ft';
        var rates = 3.28084;

        var topOut = '';
        var bottomOut = '';
        var distance_km_m = '';
        var distance_mi_ft = '';

        if (order == 1) { // 测量距离
            // 1米=3.2808398950131英尺
            if (topUnit == 'km') {
                bottomUnit = 'mi';
                // 1千米=0.62137119223733英里
                rates = 0.62137119223733;
                distance_km_m = topMeasure.toFixed(3) + 'km';
                if (message.isSupportMI) {
                    distance_mi_ft = (topMeasure * rates).toFixed(3) + 'mi';
                }
            } else if (topUnit == 'mi') {
                bottomUnit = 'km';
                // 1英里=1.609344千米
                rates = 1.609344;
                distance_mi_ft = topMeasure.toFixed(3) + 'mi';
                if (message.isSupportKM) {
                    distance_km_m = (topMeasure * rates).toFixed(3) + 'km';
                }
            } else if (topUnit == 'm') {
                bottomUnit = 'ft';
                // 1米（m）=3.28084英尺（ft）
                rates = 3.28084;
                distance_km_m = topMeasure.toFixed(3) + 'm';
                if (message.isSupportMI) {
                    distance_mi_ft = (topMeasure * rates).toFixed(3) + 'ft';
                }
            } else {
                bottomUnit = 'm';
                // 1英尺（ft）=0.3048米（m）
                rates = 0.3048;
                distance_mi_ft = topMeasure.toFixed(3) + 'ft';
                if (message.isSupportKM) {
                    distance_km_m = (topMeasure * rates).toFixed(3) + 'm';
                }
            }
            var bottomMeasure = topMeasure * rates;

            if (distance_km_m != '') {
                topOut += distance_km_m;
            }
            if (topOut != '' && distance_mi_ft != '') {
                topOut += '&nbsp;|&nbsp;' + distance_mi_ft;
            } else {
                topOut += distance_mi_ft;
            }
            // topOut = topMeasure.toFixed(3) + ' ' +
            // unitMessageHashMap.get(topUnit);
            bottomOut = bottomMeasure.toFixed(3) + ' '
                    + unitMessageHashMap.get(bottomUnit);
        } else if (order == 2) { // 测量面积
            polygonArea = topMeasure.toFixed(3) + " " + topUnit + "<sup>2</"
                    + "sup>";
        }

        if (undefined != pointArray && pointArray.length == 0) {
            if (measureResultLlayer != null) {
                measureResultLlayer.removeAllFeatures({
                    silent : true
                });
            }
        }

        var picPath = rootPath + 'resource/img/icon/measurePoint.png';
        if (measurePicPath != null && typeof measurePicPath != 'undefined'
                && measurePicPath != '') {
            picPath = measurePicPath;
        }
        var pointStyle = {
            graphicWidth : 24,
            graphicHeight : 24,
            graphicXOffset : -12,
            graphicYOffset : -24,
            graphicOpacity : 1,
            externalGraphic : picPath
        };

        if (!lastMeasureResult) {// add by zhaoding
            popupMeasureResult(topOut);
        }

        if (pointArray.length > 1) {
            if (flag == 0) {
                if (measureResultLlayer != null) {
                    measureResultLlayer.removeAllFeatures({
                        silent : true
                    });
                } else if (measureResultLlayer == null) {
                    measureResultLlayer = new OpenLayers.Layer.Vector(
                            'measureResult');
                    mapObj.addLayer(measureResultLlayer);
                }

                var itemObj = new OpenLayers.Geometry.Point(pointArray[flag].x,
                        pointArray[flag].y);
                var itemVec = new OpenLayers.Feature.Vector(itemObj, null,
                        pointStyle);
                measureResultLlayer.addFeatures([itemVec]);

                for (var i = mapObj.popups.length - 1; i >= 0; i--) { // 清除弹框
                    mapObj.removePopup(mapObj.popups[i]);
                }
                var contentHTML = '';
                if (globalGisCulture == 'en') {
                    contentHTML = GlobalMessages_en.Measurement_Start;
                } else {
                    contentHTML = GlobalMessages_zh.Measurement_Start;
                }
                calAddPopupByLonlat(new Date().getTime(), pointArray[flag].x,
                        pointArray[flag].y, contentHTML, 20, 10, false);
                flag = 1;
            }
            if (flag != 0 && (pointArray.length - 1) > flag) {
                var itemObj = new OpenLayers.Geometry.Point(pointArray[flag].x,
                        pointArray[flag].y);
                var itemVec = new OpenLayers.Feature.Vector(itemObj, null,
                        pointStyle);
                measureResultLlayer.addFeatures([itemVec]);
                calAddPopupByLonlat(new Date().getTime(), pointArray[flag].x,
                        pointArray[flag].y, topOut, 20, 10, false);
                flag = pointArray.length - 1;
            }
            if (lastMeasureResult == true) {
                lastMeasureResult = false;
                var len = mapObj.popups.length;
                for (var i = len - 1; i >= 0; i--) {
                    var id = mapObj.popups[i].id;
                    var re = new RegExp("popup_Measurement", "g");
                    if (id.match(re)) {
                        mapObj.removePopup(mapObj.popups[i]);
                    }
                }
                var itemVec;
                var contentHTML = '';
                if (globalGisCulture == 'en') {
                    contentHTML = GlobalMessages_en.Measurement_TotalDistance
                            + '&nbsp;:&nbsp;';
                } else {
                    contentHTML = GlobalMessages_zh.Measurement_TotalDistance
                            + '&nbsp;:&nbsp;';
                }
                var pointArrayLen = pointArray.length;
                if (navigator.userAgent.toLowerCase().indexOf('chrome') != -1
                        || (navigator.userAgent.toLowerCase().indexOf('msie') != -1)) {
                    var itemObj = new OpenLayers.Geometry.Point(
                            pointArray[pointArrayLen - 1].x,
                            pointArray[pointArrayLen - 1].y);
                    itemVec = new OpenLayers.Feature.Vector(itemObj, null,
                            pointStyle);
                    if (flag == pointArrayLen) {
                        var popupMakerDom = document
                                .getElementById('popup_maker_'
                                        + mapObj.popups[mapObj.popups.length - 1].ids);
                        popupMakerDom.parentNode.removeChild(popupMakerDom);
                        mapObj
                                .removePopup(mapObj.popups[mapObj.popups.length - 1]);
                    }
                    calAddPopupByLonlat(new Date().getTime(),
                            pointArray[pointArrayLen - 1].x,
                            pointArray[pointArrayLen - 1].y, contentHTML
                                    + topOut, 20, 10, true);
                } else {
                    var itemObj = new OpenLayers.Geometry.Point(
                            pointArray[flag].x, pointArray[flag].y);
                    itemVec = new OpenLayers.Feature.Vector(itemObj, null,
                            pointStyle);
                    calAddPopupByLonlat(new Date().getTime(),
                            pointArray[flag].x, pointArray[flag].y, contentHTML
                                    + topOut, 20, 10, true);
                }
                measureResultLlayer.addFeatures([itemVec]);
                flag = pointArrayLen - 1;

            }
        }
    };

    var calAddPopupByLonlat = function(id, lon, lat, contentHTML, width,
            height, lastMeasurePoint, zIndex, popupStyle) {
        var lonlat = new OpenLayers.LonLat(lon, lat);
        var pos = mapObj.getLayerPxFromLonLat(lonlat);
        // 弹出框
        var popup = new OpenLayers.Popup.FramedCloud('popup_maker_' + id,
                lonlat, null, contentHTML, null, true, function(e) {
                    var len = mapObj.popups.length;
                    for (var i = len - 1; i >= 0; i--) {
                        var isMeasurePopup = mapObj.popups[i].isMeasurePopup;
                        if (typeof isMeasurePopup != 'undefined'
                                && isMeasurePopup) {
                            var popupMakerDom = document
                                    .getElementById('popup_maker_'
                                            + mapObj.popups[i].ids);
                            if (popupMakerDom != null) {
                                popupMakerDom.parentNode
                                        .removeChild(popupMakerDom);
                            }
                        }
                        mapObj.removePopup(mapObj.popups[i]);
                    }
                    setMeasurementMode('none');
                    OpenLayers.Event.stop(e);
                }, popupStyle);
        // 矩形样式
        popup.minSize = new OpenLayers.Size(width, height);
        popup.closeOnMove = false;
        popup.autoSize = true;
        popup.isMeasurePopup = true;

        mapObj.addPopup(popup);
        // 去除关闭按钮
        if (typeof (zIndex) != 'undefined') {
            document.getElementById('popup_maker_' + id).style.zIndex = zIndex;
            popup.zIndex = zIndex;
        } else {
            for (var k = 0; k < mapObj.popups.length; k++) {
                if (mapObj.popups[k].ids == id) {
                    break;
                }
            }
            document.getElementById('popup_maker_' + id).style.zIndex = 760 + k;
            popup.zIndex = 760 + k;
        }

        // 修改样式
        var popupMakerW = document.getElementById('popup_maker_' + id).style.width;
        if (!lastMeasurePoint) {
            document.getElementById('popup_maker_' + id + '_close').style.display = "none";
            document.getElementById('popup_maker_' + id).style.width = (parseInt(popupMakerW) - 15)
                    + 'px';
        } else {// 测距结束标签
            document.getElementById('popup_maker_' + id + '_close').style.display = "block";
            var closeTop = document.getElementById('popup_maker_' + id
                    + '_close').style.top;
            document.getElementById('popup_maker_' + id).style.width = (parseInt(popupMakerW) - 5)
                    + 'px';
            document.getElementById('popup_maker_' + id + '_close').style.top = (parseInt(closeTop) - 8)
                    + 'px';
            // 增加点击事件
            document.getElementById('popup_maker_' + id + '_close').onclick = function(
                    e) {
                var len = mapObj.popups.length;
                for (var i = len - 1; i >= 0; i--) {
                    var isMeasurePopup = mapObj.popups[i].isMeasurePopup;
                    if (typeof isMeasurePopup != 'undefined' && isMeasurePopup) {
                        var popupMakerDom = document
                                .getElementById('popup_maker_'
                                        + mapObj.popups[i].ids);
                        if (popupMakerDom != null) {
                            popupMakerDom.parentNode.removeChild(popupMakerDom);
                        }
                        mapObj.removePopup(mapObj.popups[i]);
                    }
                }
                setMeasurementMode('none');
                OpenLayers.Event.stop(e);
            };
        }

        document.getElementById('popup_maker_' + id + '_contentDiv').style.width = (parseInt(document
                .getElementById('popup_maker_' + id + '_contentDiv').style.width) + 5)
                + 'px';
        document.getElementById('popup_maker_' + id + '_FrameDecorationDiv_4').style.display = "none";
        var contentDivTop = document.getElementById('popup_maker_' + id
                + '_contentDiv').style.top;
        if (contentDivTop == '40px') {
            document.getElementById('popup_maker_' + id).style.top = (pos.y - 40)
                    + 'px';
        } else {
            document.getElementById('popup_maker_' + id).style.top = (pos.y - 7)
                    + 'px';
        }
        document.getElementById('popup_maker_' + id).style.left = (pos.x + 10)
                + 'px';
        if (navigator.userAgent.toLowerCase().indexOf('msie') >= 0) {
            if (navigator.userAgent.split(';')[1].toLowerCase().indexOf(
                    'msie 8.0') >= 0) {
                var popupMakerHeight = document.getElementById('popup_maker_'
                        + id).style.height;
                document.getElementById('popup_maker_' + id).style.height = (parseInt(popupMakerHeight) - 13)
                        + 'px';
            } else {
                if (contentDivTop == '40px') {
                    document.getElementById('popup_maker_' + id).style.height = parseInt(53)
                            + 'px';
                } else {
                    document.getElementById('popup_maker_' + id).style.height = parseInt(22)
                            + 'px';
                    document.getElementById('popup_maker_' + id
                            + '_FrameDecorationDiv_0').style.height = parseInt(22)
                            + 'px';
                    document.getElementById('popup_maker_' + id
                            + '_FrameDecorationDiv_1').style.height = parseInt(22)
                            + 'px';
                }
                var re = new RegExp("起点", "g");
                var re1 = new RegExp("Start", "g");
                if (contentHTML.match(re) || contentHTML.match(re1)) {
                    document.getElementById('popup_maker_' + id).style.height = parseInt(53)
                            + 'px';
                }
            }
        } else {
            var popupMakerHeight = document.getElementById('popup_maker_' + id).style.height;
            document.getElementById('popup_maker_' + id).style.height = (parseInt(popupMakerHeight) - 13)
                    + 'px';
        }
        var popupMakerContentDivTop = document.getElementById('popup_maker_'
                + id + '_contentDiv').style.top;
        document.getElementById('popup_maker_' + id + '_contentDiv').style.top = (parseInt(popupMakerContentDivTop) - 7)
                + 'px';

        if (navigator.userAgent.toLowerCase().indexOf('chrome') != -1
                || navigator.userAgent.split(';')[1].toLowerCase().indexOf(
                        'msie 8.0') == -1) {
            if (typeof (opacity) != 'undefined') {
                popup.setOpacity(opacity);
            } else {
                popup.setOpacity(0.8);
            }
        }
        popup.ids = id;
        popup.lon = lon;
        popup.lat = lat;
        popup.contentHTML = contentHTML;
        popup.width = width;
        popup.height = height;
        popup.popupStyle = popupStyle;
        popup.lastMeasurePoint = lastMeasurePoint;

        if (!lastMeasurePoint) {
            var popupMakerDom = document.getElementById('popup_maker_' + id);
            var popupMakerLable = toLable(popupMakerDom);
            var parentDom = popupMakerDom.parentNode;
            parentDom.removeChild(popupMakerDom);
            // console.log(popupMakerDom.id + ' delete DIV');
            parentDom.appendChild(popupMakerLable);
            // console.log(popupMakerDom.id + ' add Lable');
        }
    };

    var toLable = function(popupMakerDom) {
        var popupMakerLable = document.createElement('label');
        popupMakerLable.id = popupMakerDom.id;
        popupMakerLable.className = popupMakerDom.className;
        popupMakerLable.style.position = popupMakerDom.style.position;
        popupMakerLable.style.overflow = popupMakerDom.style.overflow;
        popupMakerLable.style.left = popupMakerDom.style.left;
        popupMakerLable.style.top = popupMakerDom.style.top;
        popupMakerLable.style.opacity = popupMakerDom.style.opacity;
        popupMakerLable.style.width = popupMakerDom.style.width;
        popupMakerLable.style.height = popupMakerDom.style.height;
        popupMakerLable.style.zIndex = popupMakerDom.style.zIndex;
        popupMakerLable.innerHTML = popupMakerDom.innerHTML;
        return popupMakerLable;
    };

    var toDiv = function(popupMakerDom) {
        var popupMakerDiv = document.createElement('div');
        popupMakerDiv.id = popupMakerDom.id;
        popupMakerDiv.className = popupMakerDom.className;
        popupMakerDiv.style.position = popupMakerDom.style.position;
        popupMakerDiv.style.overflow = popupMakerDom.style.overflow;
        popupMakerDiv.style.left = popupMakerDom.style.left;
        popupMakerDiv.style.top = popupMakerDom.style.top;
        popupMakerDiv.style.opacity = popupMakerDom.style.opacity;
        popupMakerDiv.style.width = popupMakerDom.style.width;
        popupMakerDiv.style.height = popupMakerDom.style.height;
        popupMakerDiv.style.zIndex = popupMakerDom.style.zIndex;
        popupMakerDiv.innerHTML = popupMakerDom.innerHTML;
        return popupMakerDiv;
    };

    var popupMeasureResult = function(measureResult, centerLonLat) {
        var totalDistanceText = null;
        var tipsText = null;
        if (globalGisCulture == 'en') {
            totalDistanceText = GlobalMessages_en.Measurement_TotalDistance;
            tipsText = GlobalMessages_en.Measurement_ClickAndDbClickTips;
        } else {
            totalDistanceText = GlobalMessages_zh.Measurement_TotalDistance;
            tipsText = GlobalMessages_zh.Measurement_ClickAndDbClickTips;
        }
        var contentHTML = '<div class="measurePopup">'
                + '<div class="topText">' + totalDistanceText + '&nbsp;:&nbsp;'
                + measureResult + '</div>' + '<div class="bottomText">'
                + tipsText + '</div>';
        var len = mapObj.popups.length;
        for (var i = len - 1; i >= 0; i--) {
            var id = mapObj.popups[i].id;
            var re = new RegExp("popup_maker_", "g");
            if (!id.match(re)) {
                mapObj.removePopup(mapObj.popups[i]);
            }
        }
        if (typeof (centerLonLat) == 'undefined') {
            if (undefined != pointArray && undefined != pointArray[flag]) {
                centerLonLat = new OpenLayers.LonLat(pointArray[flag].x,
                        pointArray[flag].y);
            }
        }
        var popup = new OpenLayers.Popup.Anchored('popup_Measurement',
                centerLonLat, new OpenLayers.Size(166, 50), contentHTML, null,
                true, function(e) {
                    setMeasurementMode('none');
                    var len = mapObj.popups.length;
                    for (var i = len - 1; i >= 0; i--) {
                        mapObj.removePopup(mapObj.popups[i]);
                    }
                    OpenLayers.Event.stop(e);
                });
        popup.minSize = new OpenLayers.Size(166, 50);
        popup.closeOnMove = false;
        popup.autoSize = true;
        popup.isMeasurePopup = true;
        mapObj.addPopup(popup);
        if (typeof (opacity) != 'undefined') {
            popup.setOpacity(opacity);
        } else {
            popup.setOpacity(0.85);
        }

        var pos = mapObj.getLayerPxFromLonLat(centerLonLat);
        document.getElementById('popup_Measurement').style.top = (pos.y + 10)
                + 'px';
        document.getElementById('popup_Measurement').style.left = (pos.x + 10)
                + 'px';
        document.getElementById('popup_Measurement').style.border = '1px solid #208098';
        document.getElementById('popup_Measurement').style.background = '#F4FDFF';

        popup.measureResult = measureResult;
        popup.centerLonLat = centerLonLat;

    };

    // 内部函数,实现坐标转换(从外部转入地图，4326转900913)
    /*
     * 参数sourceObj:
     */
    var transform = function(sourceObj) {
        if (transformInd) {
            sourceObj.transform(sourceProj, targetProj);
        }
        return sourceObj;
    };

    // 内部函数,实现坐标反向转换(从地图转入外部，900913转4326)
    /*
     * 参数sourceObj:
     */
    var reTransform = function(sourceObj) {
        if (transformInd) {
            sourceObj.transform(targetProj, sourceProj);
        }
        return sourceObj;
    };

    // 初始化单选feature控件
    var initSingleSelectCtl = function(layerVector) {
        if (singleSelectCtl != null) {
            singleHoverSelectCtl.setLayer(layerVector);
            singleSelectCtl.setLayer(layerVector);
        } else {
            singleHoverSelectCtl = new OpenLayers.Control.SelectFeature(
                    layerVector, {
                        hover : true,
                        highlightOnly : true,
                        renderIntent : 'temporary',
                        eventListeners : {
                            featurehighlighted : highlightFunc,
                            featureunhighlighted : unhighlightFunc
                        }
                    });
            singleSelectCtl = new OpenLayers.Control.SelectFeature(layerVector,
                    {
                        clickout : true
                    });
            mapObj.addControl(singleHoverSelectCtl);
            mapObj.addControl(singleSelectCtl);
            singleHoverSelectCtl.activate();
            singleSelectCtl.activate();
        }
    };

    var highlightFunc = function(e) {
        if (popupHover != null) {
            mapObj.removePopup(popupHover);
        }
        var floatCon = null;
        if (e.feature.attributes.jsonObj != undefined) {
            floatCon = e.feature.attributes.jsonObj.floatCon;
        }
        if (typeof (floatCon) != 'undefined' && floatCon != null
                && !moveSiteMode) {
            var lonlat = e.feature.geometry.getBounds().getCenterLonLat();
            popupHover = new OpenLayers.Popup.Anchored('popupHover', lonlat,
                    null, floatCon, null, false);
            popupHover.minSize = new OpenLayers.Size(50, 15);
            popupHover.autoSize = true;
            popupHover.opacity = 0.8;
            mapObj.addPopup(popupHover);
        }
    };
    var unhighlightFunc = function(e) {
        if (popupHover != null) {
            mapObj.removePopup(popupHover);
        }
    };
    // 设置进入多选模式(创建对象组模式) ,该函数会自动取消框选放大/测距/单选feature;
    var setMultiSelectMode = function(mapAppParmObj, layerVector) {
        if (singleSelectCtl != null) {
            singleSelectCtl.deactivate();
        }

        if (multiSelectCtl != null) {
            multiSelectCtl.setLayer(layerVector);
            multiSelectCtl.deactivate();
            multiSelectCtl.activate();
            // multiSelectCtl.div.style.borderColor = "#FF00FF";
            // document.getElementsByClassName("olHandlerBoxSelectFeature").style.borderColor
            // = "green";
        }
    };

    // 设置进入多选模式(创建对象组模式) ,该函数会自动取消框选放大/测距/单选feature;
    var initMultiSelectCtl = function(mapAppParmObj, boxStyle,
            boxSelectStartFunc, boxSelectEndFunc) {

        if (multiSelectCtl == null) {
            var layerVector = [];
            multiSelectCtl = new OpenLayers.Control.SelectFeature(layerVector,
                    {
                        // handlerOptions:{
                        // fillColor:'red',
                        // strokeColor:'white'
                        // },
                        click : true,
                        clickout : false,
                        toggle : true,
                        multiple : true,
                        hover : false,
                        toggleKey : 'ctrlKey', // ctrl key removes from
                        // selection
                        multipleKey : 'shiftKey', // shift key adds to
                        // selection
                        box : true,
                        boxStyle : boxStyle,
                        eventListeners : {
                            'boxselectionstart' : function(evt) {
                                if (typeof boxSelectStartFunc == 'function') {
                                    boxSelectStartFunc();
                                }
                            },
                            'boxselectionend' : function(evt) {
                                if (typeof boxSelectEndFunc == 'function') {
                                    boxSelectEndFunc();
                                }
                            }
                        }
                    });

            mapObj.addControl(multiSelectCtl);
            // 注册Select事件
            multiSelectCtl.onSelect = onSelectFeature;
            // 注册取消Select事件
            multiSelectCtl.onUnselect = onUnSelectFeature;
        }
    };
    var onSelectFeature = function(feature) {
        var jsonObj = feature.attributes.jsonObj;
        cellInfoObj.push(jsonObj);
    };
    // Feature取消选中事件响应
    var onUnSelectFeature = function(feature) {
        var jsonObj = feature.attributes.jsonObj;
        cellInfoObj.removeObj(jsonObj);
    };

    /**
     * 获取多选小区信息
     */
    var getSelectCellInfo = function() {
        return cellInfoObj;
    };

    /**
     * 置空小区信息数组
     */
    var setSelectCellInfo = function() {
        cellInfoObj = [];
    };
    // 退出多选模式(创建对象组模式)
    var cancelMultiSelectMode = function() {
        if (singleSelectCtl != null) {
            singleSelectCtl.activate();
        }
        if (multiSelectCtl != null) {
            multiSelectCtl.deactivate();
        }
    };

    // 设置测量模式
    /**
     * 参数分别是 mode:noneToggle:取消测试模式,lineToggle:测长度,polygonToggle:测面积
     * pointPicturePath: 测距的点图片路径，绝对路径
     */
    var setMeasurementMode = function(mode, pointPicturePath, dbCallBackFuction) {
        var control = null;
        for ( var key in measureControls) {
            control = measureControls[key];
            if (mode == key) {
                control.deactivate();
                control.activate();
                if (mode == 'line') {
                    measurePicPath = pointPicturePath;
                    control.dbCallBackFuction = dbCallBackFuction;
                }
                if (mode == 'polygon') {
                    measurePicPath = pointPicturePath;
                    control.dbCallBackFuction = dbCallBackFuction;
                }

            } else {
                control.deactivate();
                if (measureResultLlayer != null) {
                    measureResultLlayer.removeAllFeatures({
                        silent : true
                    });
                    measurePicPath = null;
                }
                if (typeof control.measurePathLayer != 'undefined'
                        && control.measurePathLayer != null) {
                    control.measurePathLayer.destroyFeatures();
                    control.measurePathLayer.destroy();
                }
                var len = mapObj.popups.length;
                for (var i = len - 1; i >= 0; i--) {
                    var isMeasurePopup = mapObj.popups[i].isMeasurePopup;
                    if (typeof isMeasurePopup != 'undefined' && isMeasurePopup) {
                        mapObj.removePopup(mapObj.popups[i]);
                        // mapObj.popups[i].destroy();
                        break;
                    }
                }
                flag = 0;
            }
        }
    };

    this.getMapObject = function() {
        return mapObj;
    };

    this.getSingleSelectCtl = function() {
        return singleSelectCtl;
    };
    this.getMultiSelectCtl = function() {
        return multiSelectCtl;
    };

    // 设置圈选放大模式.
    /**
     * mode：0-正常模式，1-为圈选放大
     */
    var setPanZoomMode = function(mode) {
        if (mode == 0) {
            navbar.disableZoomBox();
        } else {
            navbar.enableZoomBox();
        }
    };

    // 取消所有feature选择
    var unselectAllFeatures = function() {
        if (singleSelectCtl != null) {
            singleSelectCtl.unselectAll();
        }
        if (multiSelectCtl != null) {
            multiSelectCtl.unselectAll();
        }
    };

    // 进入或退出多选模式中导航模式(创建对象组模式)
    var disableMultiSelectMode = function(disableInd) {
        if (multiSelectCtl != null) {
            if (disableInd) {
                multiSelectCtl.deactivate();
            } else {
                multiSelectCtl.activate();
            }
        }
    };
    /**
     * 计算两点之间的距离
     */
    var calculationDistance = function(lat1, lon1, lat2, lon2) {
        var R = 6371.004;// 地球半径 km
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(lat1 * Math.PI / 180)
                * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2)
                * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c;
        return Math.round(d * 1000);
    };

    /**
     * 求数组中最小值。
     * 
     * @param {Array}
     *            array
     * @return {float}
     */
    var calMinNumInArray = function(array) {
        var min = 0.0;
        if (array != null && array.length > 0) {
            for (var i = 0; i < array.length; i++) {
                var temp = array[i];
                if (i == 0) {
                    min = temp;
                }
                if (temp < min) {
                    min = temp;
                }
            }
        }
        return min;
    };

    /**
     * 字符串为空判断。
     * 
     * @param {String}
     *            str
     * @return {Boolean}
     */
    var isNotNull = function(str) {
        if (null != str && null != str && 'undefined' != str) {
            return true;
        } else {
            return false;
        }
    };

    /**
     * 求两点指点的坐标系距离。
     * 
     * @param {Object}
     *            pointSource
     * @param {Object}
     *            pointTarget
     */
    var calDistanceBetweenTwoPoint = function(pointSource, pointTarget) {
        var lont = pointTarget.split(',')[0];
        var latt = pointTarget.split(',')[1];
        var lons = pointSource.split(',')[0];
        var lats = pointSource.split(',')[1];
        var distance = Math.sqrt([(lont - lons) * (lont - lons) + (latt - lats)
                * (latt - lats)]);
        return distance;
    };
    var getpolygonArea = function() {
        return polygonArea;
    };
    /**
     * 设置是否是移站状态
     */
    var setMoveSiteMode = function(mode) {
        moveSiteMode = mode;
    };
    var isMoveSiteMode = function() {
        return moveSiteMode;
    };
    var setMoveCustomerMode = function(mode) {
        moveCustomerMode = mode;
    };
    // var setPolygonCallback = function(polygonCallback){
    // boxControls.featureAdded = polygonCallback;
    // };

    this.getTransformInd = function() {
        return transformInd;
    };
    this.getCurmaptype = function() {
        return curmaptype;
    };
    this.getCrossLineLayerObj = function() {
        return crossLineLayerObj;
    };

    /**
     * 设置Bing地图枚举与比例尺的对应关系
     */
    var setBingBoomLever = function() {
        bingBoomLever.put("5000km/2000mi", 1);
        bingBoomLever.put("2000km/1000mi", 2);
        bingBoomLever.put("1000km/1000mi", 3);
        bingBoomLever.put("500km/200mi", 4);
        bingBoomLever.put("200km/100mi", 5);
        bingBoomLever.put("100km/100mi", 6);
        bingBoomLever.put("100km/50mi", 7);
        bingBoomLever.put("20km/20mi", 8);
        bingBoomLever.put("10km/10mi", 9);
        bingBoomLever.put("10km/5mi", 10);
        bingBoomLever.put("5km/2mi", 11);
        bingBoomLever.put("2km/1mi", 12);
        bingBoomLever.put("1000m/2000ft", 13);
        bingBoomLever.put("500m/1000ft", 14);
        bingBoomLever.put("200m/1000ft", 15);
        bingBoomLever.put("100m/500ft", 16);
        bingBoomLever.put("100m/200ft", 17);
    };
    /**
     * 设置Goolge地图枚举与比例尺的对应关系
     */
    var setGooleBoomLever = function() {
        gooleBoomLever.put("2000km/1000mi", 3);
        gooleBoomLever.put("1000km/1000mi", 4);
        gooleBoomLever.put("500km/200mi", 5);
        gooleBoomLever.put("200km/100mi", 6);
        gooleBoomLever.put("100km/100mi", 7);
        gooleBoomLever.put("100km/50mi", 8);
        gooleBoomLever.put("20km/20mi", 9);
        gooleBoomLever.put("10km/10mi", 10);
        gooleBoomLever.put("10km/5mi", 11);
        gooleBoomLever.put("5km/2mi", 12);
        gooleBoomLever.put("2km/1mi", 13);
        gooleBoomLever.put("1000m/2000ft", 14);
        gooleBoomLever.put("500m/1000ft", 15);
        gooleBoomLever.put("200m/1000ft", 16);
        gooleBoomLever.put("100m/500ft", 17);
    };

    /**
     * 设置openStreet地图枚举与比例尺的对应关系
     */
    var setOpenStreetBoomLever = function() {
        openStreetBoomLever.put("2000km/1000mi", 3);
        openStreetBoomLever.put("1000km/1000mi", 4);
        openStreetBoomLever.put("500km/200mi", 5);
        openStreetBoomLever.put("200km/100mi", 6);
        openStreetBoomLever.put("100km/100mi", 7);
        openStreetBoomLever.put("100km/50mi", 8);
        openStreetBoomLever.put("20km/20mi", 9);
        openStreetBoomLever.put("10km/10mi", 10);
        openStreetBoomLever.put("10km/5mi", 11);
        openStreetBoomLever.put("5km/2mi", 12);
        openStreetBoomLever.put("2km/1mi", 13);
        openStreetBoomLever.put("1000m/2000ft", 14);
        openStreetBoomLever.put("500m/1000ft", 15);
        openStreetBoomLever.put("200m/1000ft", 16);
        openStreetBoomLever.put("100m/500ft", 17);
        openStreetBoomLever.put("100m/200ft", 18);
    };
    /**
     * 设置WMS地图枚举与比例尺的对应关系
     */
    var setWmsBoomLever = function() {
        wmsBoomLever.put("1000km/1000mi", 1);
        wmsBoomLever.put("500km/200mi", 2);
        wmsBoomLever.put("200km/100mi", 3);
        wmsBoomLever.put("100km/100mi", 4);
        wmsBoomLever.put("100km/50mi", 5);
        wmsBoomLever.put("20km/20mi", 6);
        wmsBoomLever.put("10km/10mi", 7);
        wmsBoomLever.put("10km/5mi", 8);
        wmsBoomLever.put("5km/2mi", 9);
        wmsBoomLever.put("2km/1mi", 10);
        wmsBoomLever.put("1000m/2000ft", 11);
        wmsBoomLever.put("500m/1000ft", 12);
        wmsBoomLever.put("200m/1000ft", 13);
        wmsBoomLever.put("100m/500ft", 14);
        wmsBoomLever.put("100m/200ft", 15);
        wmsBoomLever.put("20m/100ft", 16);
        wmsBoomLever.put("10m/50ft", 17);
    };

    /**
     * 设置ArcGis地图枚举与比例尺的对应关系
     */
    var setArcGisBoomLever = function() {
        arcGisBoomLever.put("1000km/1000mi", 1);
        arcGisBoomLever.put("500km/200mi", 2);
        arcGisBoomLever.put("200km/100mi", 3);
        arcGisBoomLever.put("100km/100mi", 4);
        arcGisBoomLever.put("100km/50mi", 5);
        arcGisBoomLever.put("20km/20mi", 6);
        arcGisBoomLever.put("10km/10mi", 7);
        arcGisBoomLever.put("10km/5mi", 8);
        arcGisBoomLever.put("5km/2mi", 9);
        arcGisBoomLever.put("2km/1mi", 10);
        arcGisBoomLever.put("1000m/2000ft", 11);
        arcGisBoomLever.put("500m/1000ft", 12);
        arcGisBoomLever.put("200m/1000ft", 13);
        arcGisBoomLever.put("100m/500ft", 14);
        arcGisBoomLever.put("100m/200ft", 15);
        arcGisBoomLever.put("20m/100ft", 16);
        arcGisBoomLever.put("10m/50ft", 17);
    };
    /**
     * 设置公用地图枚举与比例尺的对应关系
     */
    var setBlankBoomLever = function() {
        blankBoomLever.put("10000km/5000mi", 1);
        blankBoomLever.put("5000km/2000mi", 2);
        blankBoomLever.put("2000km/1000mi", 3);
        blankBoomLever.put("1000km/1000mi", 4);
        blankBoomLever.put("500km/200mi", 5);
        blankBoomLever.put("200km/100mi", 6);
        blankBoomLever.put("100km/100mi", 7);
        blankBoomLever.put("100km/50mi", 8);
        blankBoomLever.put("20km/20mi", 9);
        blankBoomLever.put("10km/10mi", 10);
        blankBoomLever.put("10km/5mi", 11);
        blankBoomLever.put("5km/2mi", 12);
        blankBoomLever.put("2km/1mi", 13);
        blankBoomLever.put("1000m/2000ft", 14);
        blankBoomLever.put("500m/1000ft", 15);
        blankBoomLever.put("200m/100ft", 16);
        blankBoomLever.put("100m/500ft", 17);
    };

    /*
     * type [0:空白地图，1:openstreet，2:google,3:bing,11:wms,13:arcGis]
     */
    var chooseBoomByMapType = function(mapParmObj) {
        // 获取地图类型
        var type = mapParmObj.type;
        // 根据地图类型返回不同的地图枚举与比例尺的对应关系
        switch (type) {
        case 0:
            setBlankBoomLever();
            return blankBoomLever;
            break;
        case 1:
            setOpenStreetBoomLever();
            return openStreetBoomLever;
            break;
        case 2:
            setGooleBoomLever();
            return gooleBoomLever;
            break;
        case 3:
            setBingBoomLever();
            return bingBoomLever;
            break;
        case 11:
            setWmsBoomLever();
            return wmsBoomLever;
            break;
        case 13:
            setArcGisBoomLever();
            return arcGisBoomLever;
            break;
        default:
            setBlankBoomLever();
            return blankBoomLever;
        }

    };

    this.initMap = initMap;
    this.transform = transform;
    this.reTransform = reTransform;
    this.terminate = terminate;
    this.setMeasurementMode = setMeasurementMode;
    this.getPolygonControlPointStr = getPolygonControlPointStr;
    this.getLineControlPointStr = getLineControlPointStr;
    this.setPolygonControlMode = setPolygonControlMode;
    this.setBoxControlMode = setBoxControlMode;
    this.clearDraw = clearDraw;
    this.stopDraw = stopDraw;
    this.setLineControlMode = setLineControlMode;
    this.setLineActivities = setLineActivities;
    this.setPanZoomMode = setPanZoomMode;
    this.initSingleSelectCtl = initSingleSelectCtl;
    this.initMultiSelectCtl = initMultiSelectCtl;
    this.setMultiSelectMode = setMultiSelectMode;
    this.cancelMultiSelectMode = cancelMultiSelectMode;
    this.unselectAllFeatures = unselectAllFeatures;
    this.disableMultiSelectMode = disableMultiSelectMode;
    this.calculationDistance = calculationDistance;
    this.convertVertices2String = convertVertices2String;
    this.convertVertices2StringNo = convertVertices2StringNo;
    this.calMinNumInArray = calMinNumInArray;
    this.calDistanceBetweenTwoPoint = calDistanceBetweenTwoPoint;
    this.judgePolygonIsCross = judgePolygonIsCross;
    this.isNotNull = isNotNull;
    this.setMoveSiteMode = setMoveSiteMode;
    this.isMoveSiteMode = isMoveSiteMode;
    this.chooseBoomByMapType = chooseBoomByMapType;
    this.setMoveCustomerMode = setMoveCustomerMode;
    this.getSelectCellInfo = getSelectCellInfo;
    this.setSelectCellInfo = setSelectCellInfo;
    this.forceToResetMap = forceToResetMap;
    this.getpolygonArea = getpolygonArea;
    this.reSetMap = reSetMap;
    // this.setPolygonCallback = setPolygonCallback;
    this.popupMeasureResult = popupMeasureResult;
    this.calAddPopupByLonlat = calAddPopupByLonlat;
    this.toLable = toLable;
    this.toDiv = toDiv;
};
