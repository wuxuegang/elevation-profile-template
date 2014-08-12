define([
  "dojo/Evented",
  "dijit/_WidgetBase",
  "dijit/_OnDijitClickMixin",
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/on",
  "dojo/aspect",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/Deferred",
  "dojo/_base/array",
  "dojo/number",
  "dijit/registry",
  "dijit/Dialog",
  "dijit/Toolbar",
  "dijit/layout/ContentPane",
  "dijit/form/Button",
  "dijit/form/ToggleButton",
  "put-selector/put",
  "dojo/dom-geometry",
  "dojo/dom-style",
  "dojo/dom-class",
  "dojo/query",
  "dojo/_base/Color",
  "dojo/colors",
  "dojo/fx/easing",
  "dojox/charting/Chart",
  "dojox/charting/axis2d/Default",
  "dojox/charting/plot2d/Grid",
  "dojox/charting/plot2d/Areas",
  "dojox/charting/action2d/MouseIndicator",
  "dojox/charting/action2d/TouchIndicator",
  "dojox/charting/themes/ThreeD",
  "esri/config",
  "esri/sniff",
  "esri/request",
  "esri/dijit/Measurement",
  "esri/tasks/Geoprocessor",
  "esri/geometry/Polyline",
  "esri/symbols/SimpleLineSymbol",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/graphic",
  "esri/tasks/FeatureSet",
  "esri/tasks/LinearUnit",
  "esri/geometry/geodesicUtils",
  "esri/geometry/webMercatorUtils",
  "esri/units",
  "dojo/i18n!./nls/strings",
  "dojo/text!./Widget.html",
  "xstyle!./css/style.css"
], function (Evented, _WidgetBase, _OnDijitClickMixin, _TemplatedMixin, _WidgetsInTemplateMixin, on, aspect, declare, lang, Deferred, array, number, registry, Dialog, Toolbar, ContentPane, Button, ToggleButton, put, domGeometry, domStyle, domClass, query, Color, colors, easing, Chart, Default, Grid, Areas, MouseIndicator, TouchIndicator, ThreeD, esriConfig, esriSniff, esriRequest, Measurement, Geoprocessor, Polyline, SimpleLineSymbol, SimpleMarkerSymbol, Graphic, FeatureSet, LinearUnit, geodesicUtils, webMercatorUtils, Units, i18NStrings, dijitTemplate) {

  /**
   *  ElevationsProfile
   */
  return declare([_WidgetBase, _OnDijitClickMixin, _TemplatedMixin, _WidgetsInTemplateMixin, Evented], {

    declaredClass: "ElevationsProfile",
    baseClass: "elevationsProfile",
    templateString: dijitTemplate,

    /**
     *
     * @param options
     * @param srcRefNode
     */
    constructor: function (options, srcRefNode) {

      this.loaded = false;
      this.domNode = srcRefNode || put('div#profileChartNode');
      this.strings = i18NStrings;

      // ESRI MAP //
      this.map = null;
      // ESRI MEASUREMENT TOOL //
      this.measureTool = null;
      // ESRI PROFILE GP SERVICE //
      this.profileService = null;

      /**
       * MAKE SURE WE HAVE REQUIRED PARAMETERS
       */
      if((!options.map) || (!options.profileTaskUrl) || (!options.scalebarUnits)) {
        console.error(this.strings.errors.MissingConstructorParameters);

      } else {
        // MIXIN PARAMETERS //
        declare.safeMixin(this, options);

        // APPEND PROFILE TOOL NAME TO TASK URL //
        this.profileServiceUrl = lang.replace("{profileTaskUrl}/Profile", this);

        // DEFAULT SAMPLING POINT COUNT //
        this.samplingPointCount = 199;

        // CHART RENDERING OPTIONS //
        this.chartRenderingOptions = lang.mixin({
          chartTitleFontSize: 13,
          axisTitleFontSize: 11,
          axisLabelFontSize: 9,
          indicatorFontColor: '#eee',
          indicatorFillColor: '#666',
          titleFontColor: '#eee',
          axisFontColor: '#ccc',
          axisMajorTickColor: '#333',
          skyTopColor: "#B0E0E6",
          skyBottomColor: "#4682B4",
          waterLineColor: "#eee",
          waterTopColor: "#ADD8E6",
          waterBottomColor: "#0000FF",
          elevationLineColor: "#D2B48C",
          elevationTopColor: "#8B4513",
          elevationBottomColor: "#CD853F"
        }, options.chartOptions || {});

        // PROVIDE INSTANCE CONTEXT TO METHODS //
        this._showHelp = lang.hitch(this, this._showHelp);
        this._initMeasureTool = lang.hitch(this, this._initMeasureTool);
        this._initInfoWindow = lang.hitch(this, this._initInfoWindow);
        this._initProfileService = lang.hitch(this, this._initProfileService);
        this.displayProfileChart = lang.hitch(this, this.displayProfileChart);
        this.clearProfileChart = lang.hitch(this, this.clearProfileChart);
        this._upateProfileChart = lang.hitch(this, this._upateProfileChart);
        this._createProfileChart = lang.hitch(this, this._createProfileChart);
        this._getDisplayValue = lang.hitch(this, this._getDisplayValue);
      }

    },

    /**
     *  POSTCREATE - CONNECT UI ELEMENT EVENTS
     */
    postCreate: function () {
      this.inherited(arguments);
      this.own(
          on(this._helpNode, 'click', lang.partial(this._showHelp, false)),
          on(this._measureBtn, 'click', lang.hitch(this, this._toggleMeasurePane)),
          on(this._closePaneBtn, 'click', lang.hitch(this, this._toggleMeasurePane)),
          aspect.after(registry.getEnclosingWidget(this.domNode), 'resize', lang.hitch(this, this._resizeChart), true)
      );

    },

    /**
     *  STARTUP THE DIJIT
     */
    startup: function () {
      this.inherited(arguments);
      if((!this.map) || (!this.profileTaskUrl) || (!this.scalebarUnits)) {
        this.emit('error', new Error(this.strings.errors.MissingConstructorParameters));
        this.destroy();
      } else {
        if(this.map.loaded) {
          this._initUI();
        } else {
          this.map.on("load", this._initUI);
        }
      }
    },

    /**
     * INITIALIZE THE UI
     *
     * @private
     */
    _initUI: function () {

      // MAKE SURE WE HAVE ACCESS TO THE PROFILE SERVICE //
      this._initProfileService().then(lang.hitch(this, function () {

        this._showHelp(true);
        this._initInfoWindow();
        this._initMeasureTool();
        this._upateProfileChart();

        // DIJIT SUCCESSFULLY LOADED //
        this.loaded = true;
        this.emit("load", {});

      }), lang.hitch(this, function () {
        this.emit('error', new Error(this.strings.errors.InvalidConfiguration));
        this.destroy();
      }));

    },

    /**
     * INITIALIZE THE PROFILE SERVICE
     *
     * @returns {*}
     * @private
     */
    _initProfileService: function () {
      var deferred = new Deferred();

      if(this.profileServiceUrl) {
        // MAKE SURE PROFILE SERVICE IS AVAILABLE //
        esriRequest({
          url: this.profileServiceUrl,
          content: {f: 'json'},
          callbackParamName: "callback"
        }).then(lang.hitch(this, function (taskInfo) {
          //console.log("GP Service Details: ", taskInfo);

          // TASK DETAILS //
          this.taskInfo = taskInfo;

          // CREATE GP PROFILE SERVICE //
          this.profileService = new Geoprocessor(this.profileServiceUrl);
          this.profileService.setOutSpatialReference(this.map.spatialReference);

          // SAMPLING DISTANCE //
          this.samplingDistance = new LinearUnit();
          this.samplingDistance.units = Units.METERS;

          deferred.resolve();
        }), lang.hitch(this, function (error) {
          deferred.reject(error);
        }));
      } else {
        deferred.reject(new Error(this.strings.errors.InvalidConfiguration));
      }

      return deferred.promise;
    },

    /**
     * TOGGLE MEASURE PANE
     *
     * @private
     */
    _toggleMeasurePane: function () {
      domClass.toggle(this._measurePane, 'dijitOffScreen');
    },

    /**
     * CONNECT MAP INFOWINDOW EVENTS
     *
     * @private
     */
    _initInfoWindow: function () {
      this.map.infoWindow.on('selection-change', lang.hitch(this, this._mapFeatureSelectionChange));
      this.map.infoWindow.on('hide', lang.hitch(this, this.clearProfileChart));
    },

    /**
     * INITIALIZE ESRI MEASUREMENT DIJIT
     *
     * @private
     */
    _initMeasureTool: function () {

      // MEASUREMENT TOOL //
      this.measureTool = new Measurement({
        map: this.map,
        defaultAreaUnit: (this.scalebarUnits === 'metric') ? Units.SQUARE_KILOMETERS : Units.SQUARE_MILES,
        defaultLengthUnit: (this.scalebarUnits === 'metric') ? Units.KILOMETERS : Units.MILES
      }, this._measureNode);
      this.measureTool.startup();

      // HIDE AREA AND LOCATION TOOLS //
      this.measureTool.hideTool('area');
      this.measureTool.hideTool('location');

      // ACTIVATE/DEACTIVATE DISTANCE TOOL         //
      //   THIS WILL INITIALIZE UNITS DROPDOWN AND //
      //   ALLOW US TO CONVERT VALUES AS NECESSARY //
      this.measureTool.setTool("distance", true);
      this.measureTool.setTool("distance", false);

      // CREATE PROFILE ON DISTANCE MEASURE-END EVENT //
      this.measureTool.on('measure-end', lang.hitch(this, this._onMeasureEnd));

      // CLEAR PROFILE ON DISTANCE TOOL CLICK //
      this.measureTool.distance.on('click', lang.hitch(this, this._onMeasureClick));

      // UPDATE THE CHART WHEN USER CHANGES UNITS //
      aspect.after(this.measureTool.unit.dropDown, 'onItemClick', lang.hitch(this, this._upateProfileChart), true);

    },

    /**
     * MEASUREMENT DISTACE TOOL CLICK
     *
     * @private
     */
    _onMeasureClick: function () {
      this.clearProfileChart();
      this.map.infoWindow.clearFeatures();
      this.map.infoWindow.hide();
      this.emit("measure-distance-checked", { checked: this.measureTool.distance.checked });
    },

    /**
     * ON MEASURE-END EVENT
     *
     * @param evt
     * @private
     */
    _onMeasureEnd: function (evt) {
      if(evt.toolName === "distance") {
        this.displayProfileChart(evt.geometry);
        // UPDATE THE CHART WHEN USER CHANGES UNITS //
        aspect.after(this.measureTool.unit.dropDown, 'onItemClick', lang.hitch(this, this._upateProfileChart), true);
      }
    },

    /**
     * DISPLAY HELP DIALOG
     *
     * @param hide
     * @private
     */
    _showHelp: function (hide) {
      if(this._helpDlg) {
        this._helpDlg.set("title", i18NStrings.display.elevationProfileTitle);
        this._helpDlg.show();

        if(hide) {
          setTimeout(lang.hitch(this, function () {
            this._helpDlg.hide();
          }), 4000);
        }
      }
    },

    /**
     * MAP INFOWINDOW FEATURE SELECTTION CHANGE
     *
     * CALLED WHEN THE SELECTED FEATURE OF THE POPUP WINDOW CHANGES
     */
    _mapFeatureSelectionChange: function () {
      var selectedFeature = this.map.infoWindow.getSelectedFeature();
      var isPolyline = (selectedFeature && (selectedFeature.geometry.type === 'polyline'));
      if(isPolyline) {
        this.displayProfileChart(selectedFeature.geometry);
      } else {
        this.clearProfileChart();
      }
    },

    /**
     * GET PROFILE OVER POLYLINE FROM PROFILE SERVICE
     *
     * @param polyline
     * @returns {*}
     * @private
     */
    _getProfile: function (polyline) {
      var deferred = new Deferred();

      // CONVERT WEBMERCATOR POLYLINE TO GEOGRAPHIC        //
      // - IF NOT WEBMERCATOR ASSUME ALREADY IN GEOGRAPHIC //
      var geoPolyline = (polyline.spatialReference.isWebMercator()) ? webMercatorUtils.webMercatorToGeographic(polyline) : polyline;
      // GET LENGTH IN METERS //
      var profileLengthMeters = geodesicUtils.geodesicLengths([geoPolyline], Units.METERS)[0];
      // GET SAMPLING DISTANCE //
      var samplingDistance = (profileLengthMeters / this.samplingPointCount);

      // CREATE GP TASK INPUT FEATURE SET //
      var inputProfileGraphic = new Graphic(polyline, null, { OID: 1 });
      var inputLineFeatures = new FeatureSet();
      inputLineFeatures.features = [inputProfileGraphic];
      // MAKE SURE OID FIELD IS AVAILABLE TO GP SERVICE //
      inputLineFeatures.fields = [
        {
          name: "OID",
          type: "esriFieldTypeObjectID",
          alias: "OID"
        }
      ];

      // MAKE GP REQUEST //
      this.profileService.execute({
        "InputLineFeatures": inputLineFeatures,
        "ProfileIDField": "OID",
        "DEMResolution": "FINEST",
        "MaximumSampleDistance": samplingDistance,
        "MaximumSampleDistanceUnits": "Meters",
        "returnZ": true,
        "returnM": true
      }).then(lang.hitch(this, function (results) {

        // GET RESULT //
        if(results.length > 0) {
          var profileOutput = results[0].value;
          // GET PROFILE FEATURE //
          if(profileOutput.features.length > 0) {
            var profileFeature = profileOutput.features[0];
            // SET DEM RESOLUTION DETAILS //
            this._sourceNode.innerHTML = lang.replace("{0}: {1}", [this.strings.chart.demResolution, profileFeature.attributes.DEMResolution]);

            // GET PROFILE GEOMETRY //
            var profileGeometry = profileFeature.geometry;
            var allElevations = [];
            var allDistances = [];

            if(profileGeometry.paths.length > 0) {
              // POLYLINE PATHS //
              array.forEach(profileGeometry.paths, lang.hitch(this, function (profilePoints, pathIndex) {
                // ELEVATION INFOS //
                array.forEach(profilePoints, lang.hitch(this, function (coords, pointIndex) {
                  var elevationInfo = {
                    x: ((coords.length > 3) ? coords[3] : (pointIndex * samplingDistance)),
                    y: ((coords.length > 2) ? coords[2] : 0.0),
                    pathIdx: pathIndex,
                    pointIdx: pointIndex
                  };
                  allElevations.push(elevationInfo);
                  allDistances.push(elevationInfo.x);
                }));
              }));

              // RESOLVE TASK //
              deferred.resolve({
                geometry: profileGeometry,
                elevations: allElevations,
                distances: allDistances,
                samplingDistance: samplingDistance
              });
            } else {
              deferred.reject(new Error(this.strings.errors.UnableToProcessResults));
            }
          } else {
            deferred.reject(new Error(this.strings.errors.UnableToProcessResults));
          }
        } else {
          deferred.reject(new Error(this.strings.errors.UnableToProcessResults));
        }
      }), deferred.reject);

      return deferred.promise;
    },


    /**
     * DISPLAY PROFILE CHART
     *
     * @param geometry
     * @returns {*}
     */
    displayProfileChart: function (geometry) {
      this.map.setMapCursor('wait');
      this._getProfile(geometry).then(lang.hitch(this, function (elevationInfo) {
        this.elevationInfo = elevationInfo;
        this._upateProfileChart();
        this.emit("display-profile", elevationInfo);
      }), lang.hitch(this, function (error) {
        this.map.setMapCursor('default');
        alert(lang.replace("{message}\n\n{details.0}", error));
        this.emit('error', error);
      }));
    },

    /**
     * CLEAR PROFILE CHART
     *
     * @private
     */
    clearProfileChart: function () {
      this.elevationInfo = null;
      this._upateProfileChart();
      this.emit("clear-profile", {});
      // UPDATE THE CHART WHEN USER CHANGES UNITS //
      aspect.after(this.measureTool.unit.dropDown, 'onItemClick', lang.hitch(this, this._upateProfileChart), true);
    },

    /**
     * UPDATE PROFILE CHART
     *
     * @private
     */
    _upateProfileChart: function () {
      this.map.setMapCursor('wait');
      this._createProfileChart(this.elevationInfo).then(lang.hitch(this, function () {
        this.map.setMapCursor('default');
      }), lang.hitch(this, function (error) {
        this.map.setMapCursor('default');
        this.emit('error', error);
      }));
    },

    /**
     * CREATE PROFILE CHART
     *
     * @param elevationInfo
     * @returns {*}
     * @private
     */
    _createProfileChart: function (elevationInfo) {
      var deferred = new Deferred();

      // CHART SERIES NAMES //
      var waterDataSeriesName = "Water";
      var elevationDataSeriesName = "ElevationData";

      // MIN/MAX/STEP //
      var yMin = -10.0;
      var yMax = 100.0;

      // DID WE GET NEW ELEVATION INFORMATION //
      if(!elevationInfo) {

        // CLEAR GRAPHIC FROM MAP //
        this._displayChartLocation(-1);

        // SAMPLING DISTANCE //
        this.samplingDistance.distance = (this.map.extent.getWidth() / this.samplingPointCount);

        // GEOMETRY AND ELEVATIONS //
        this.profilePolyline = null;
        this.elevationData = this._getFilledArray(this.samplingPointCount, this.samplingDistance.distance, true);

        // CLEAR GAIN/LOSS AND SOURCE DETAILS //
        this._gainLossNode.innerHTML = "";
        this._sourceNode.innerHTML = "";

        // REMOVE ELEVATION INDICATORS //
        if(this.elevationIndicator) {
          this.elevationIndicator.destroy();
          this.elevationIndicator = null;
        }
        if(this.elevationIndicator2) {
          this.elevationIndicator2.destroy();
          this.elevationIndicator2 = null;
        }

      } else {

        // GEOMETRY, ELEVATIONS, DISTANCES AND SAMPLING DISTANCE //
        this.profilePolyline = elevationInfo.geometry;
        this.elevationData = this._convertElevationsInfoArray(elevationInfo.elevations);
        this.distances = this._convertDistancesArray(elevationInfo.distances);
        this.samplingDistance.distance = this._convertDistancesArray([elevationInfo.samplingDistance])[0];

        // CALC MIN/MAX/STEP //
        var yMinSource = this._getArrayMin(this.elevationData);
        var yMaxSource = this._getArrayMax(this.elevationData);
        var yRange = (yMaxSource - yMinSource);
        yMin = yMinSource - (yRange * 0.05);
        yMax = yMaxSource + (yRange * 0.05);

        // GAIN/LOSS DETAILS //
        var detailsNumberFormat = {places: 0};
        var elevFirst = this.elevationData[0].y;
        var elevLast = this.elevationData[this.elevationData.length - 1].y;
        var gainLossDetails = {
          min: number.format(yMinSource, detailsNumberFormat),
          max: number.format(yMaxSource, detailsNumberFormat),
          start: number.format(elevFirst, detailsNumberFormat),
          end: number.format(elevLast, detailsNumberFormat),
          gainloss: number.format((elevLast - elevFirst), detailsNumberFormat)
        };
        this._gainLossNode.innerHTML = lang.replace(this.strings.chart.gainLossTemplate, gainLossDetails);

        // REMOVE ELEVATION INDICATORS //
        if(this.elevationIndicator) {
          this.elevationIndicator.destroy();
          this.elevationIndicator = null;
        }
        if(this.elevationIndicator2) {
          this.elevationIndicator2.destroy();
          this.elevationIndicator2 = null;
        }

        // MOUSE/TOUCH ELEVATION INDICATOR //
        var indicatorProperties = {
          series: elevationDataSeriesName,
          mouseOver: true,
          font: "normal normal bold 9pt Tahoma",
          fontColor: this.chartRenderingOptions.indicatorFontColor,
          fill: this.chartRenderingOptions.indicatorFillColor,
          markerFill: 'none',
          markerStroke: { color: 'red', width: 3.0 },
          markerSymbol: "m -6 -6, l 12 12, m 0 -12, l -12 12", // RED X //
          labelFunc: lang.hitch(this, function (obj) {
            this._displayChartLocation(obj.x);
            var elevUnitsLabel = this._getDisplayUnits(true);
            var elevChangeLabel = number.format(obj.y, detailsNumberFormat);
            return lang.replace("{0} {1}", [elevChangeLabel, elevUnitsLabel]);
          })
        };
        // MOUSE/TOUCH ELEVATION CHANGE INDICATOR //
        var indicatorProperties2 = {
          series: waterDataSeriesName,
          mouseOver: true,
          font: "normal normal bold 8pt Tahoma",
          fontColor: this.chartRenderingOptions.indicatorFontColor,
          fill: this.chartRenderingOptions.indicatorFillColor,
          fillFunc: lang.hitch(this, function (obj) {
            var elevIndex = this.distances.indexOf(obj.x);
            var elev = this.elevationData[elevIndex].y;
            return (elev >= elevFirst) ? "green" : "red";
          }),
          offset: { y: 25, x: 30 },
          labelFunc: lang.hitch(this, function (obj) {
            var elevIndex = this.distances.indexOf(obj.x);
            var elev = this.elevationData[elevIndex].y;
            var elevChangeLabel = number.format(elev - elevFirst, detailsNumberFormat);
            var plusMinus = ((elev - elevFirst) > 0) ? "+" : "";
            return lang.replace("{0}{1}", [plusMinus, elevChangeLabel]);
          })
        };
        if(esriSniff("has-touch")) {
          this.elevationIndicator2 = new TouchIndicator(this.profileChart, "default", indicatorProperties2);
          this.elevationIndicator = new TouchIndicator(this.profileChart, "default", indicatorProperties);
        } else {
          this.elevationIndicator2 = new MouseIndicator(this.profileChart, "default", indicatorProperties2);
          this.elevationIndicator = new MouseIndicator(this.profileChart, "default", indicatorProperties);
        }
        this.profileChart.fullRender();
      }

      // FILLED ZERO ARRAY //
      var waterData = this._resetArray(this.elevationData, 0.0);

      // ARE WE UPDATING OR CREATING THE CHART //
      if(this.profileChart != null) {

        // UPDATE CHART //
        this.profileChart.getAxis("y").opt.min = yMin;
        this.profileChart.getAxis("y").opt.max = yMax;
        this.profileChart.getAxis("y").opt.title = lang.replace(this.strings.chart.elevationTitleTemplate, [this._getDisplayUnits(true)]);
        this.profileChart.getAxis("x").opt.title = lang.replace(this.strings.chart.distanceTitleTemplate, [this._getDisplayUnits(false)]);
        this.profileChart.dirty = true;
        this.profileChart.updateSeries(waterDataSeriesName, waterData);
        this.profileChart.updateSeries(elevationDataSeriesName, this.elevationData);
        // RENDER CHART //
        this.profileChart.render();
        deferred.resolve();

      } else {

        // MAKE SURE CHART NODE HAS VALID HEIGHT OR CHARTING WILL FAIL //
        var nodeCoords = domGeometry.position(this._chartNode, true);
        if(nodeCoords.h < 1) {
          deferred.reject(new Error(this.strings.errors.InvalidConfiguration));
        }

        // CREATE CHART //
        this.profileChart = new Chart(this._chartNode, {
          title: this.strings.chart.title,
          titlePos: "top",
          titleGap: 10,
          titleFont: lang.replace("normal normal bold {chartTitleFontSize}pt verdana", this.chartRenderingOptions),
          titleFontColor: this.chartRenderingOptions.titleFontColor
        });

        // SET THEME //
        this.profileChart.setTheme(ThreeD);

        // OVERRIDE DEFAULTS //
        this.profileChart.fill = 'transparent';
        this.profileChart.theme.axis.stroke.width = 2;
        this.profileChart.theme.axis.majorTick = {
          color: Color.named.white.concat(0.5),
          width: 1.0
        };
        this.profileChart.theme.plotarea.fill = {
          type: "linear",
          space: "plot",
          x1: 50, y1: 100, x2: 50, y2: 0,
          colors: [
            { offset: 0.0, color: this.chartRenderingOptions.skyTopColor },
            { offset: 1.0, color: this.chartRenderingOptions.skyBottomColor }
          ]
        };

        // Y AXIS //
        this.profileChart.addAxis("y", {
          min: yMin,
          max: yMax,
          fontColor: this.chartRenderingOptions.axisFontColor,
          font: lang.replace("normal normal bold {axisLabelFontSize}pt verdana", this.chartRenderingOptions),
          vertical: true,
          natural: true,
          fixed: true,
          includeZero: false,
          majorLabels: true,
          minorLabels: true,
          majorTicks: true,
          minorTicks: true,
          majorTick: { color: this.chartRenderingOptions.axisMajorTickColor, length: 6 },
          title: lang.replace(this.strings.chart.elevationTitleTemplate, [this._getDisplayUnits(true)]),
          titleGap: 30,
          titleFont: lang.replace("normal normal bold {axisTitleFontSize}pt verdana", this.chartRenderingOptions),
          titleFontColor: this.chartRenderingOptions.titleFontColor,
          titleOrientation: 'axis'
        });

        // X AXIS //
        this.profileChart.addAxis("x", {
          fontColor: this.chartRenderingOptions.axisFontColor,
          font: lang.replace("normal normal bold {axisLabelFontSize}pt verdana", this.chartRenderingOptions),
          natural: true,
          fixed: true,
          includeZero: false,
          majorLabels: true,
          minorLabels: true,
          majorTicks: true,
          minorTicks: true,
          majorTick: { color: this.chartRenderingOptions.axisMajorTickColor, length: 6 },
          title: lang.replace(this.strings.chart.distanceTitleTemplate, [this._getDisplayUnits(false)]),
          titleGap: 5,
          titleFont: lang.replace("normal normal bold {axisTitleFontSize}pt verdana", this.chartRenderingOptions),
          titleFontColor: this.chartRenderingOptions.titleFontColor,
          titleOrientation: 'away'
        });

        // GRID //
        this.profileChart.addPlot("grid", {
          type: Grid,
          hMajorLines: true,
          hMinorLines: false,
          vMajorLines: false,
          vMinorLines: false
        });

        // PROFIlE PLOT //
        this.profileChart.addPlot("default", { type: Areas, tension: "X" });

        // WATER PLOT //
        this.profileChart.addPlot("water", { type: Areas });

        // WATER DATA //
        this.profileChart.addSeries(waterDataSeriesName, waterData, {
          plot: "water",
          stroke: {  width: 2.0, color: this.chartRenderingOptions.waterLineColor },
          fill: {
            type: "linear",
            space: "plot",
            x1: 50, y1: 0, x2: 50, y2: 100,
            colors: [
              { offset: 0.0, color: this.chartRenderingOptions.waterTopColor },
              { offset: 1.0, color: this.chartRenderingOptions.waterBottomColor }
            ]
          }
        });

        // PROFILE DATA //
        this.profileChart.addSeries(elevationDataSeriesName, this.elevationData, {
          plot: "default",
          stroke: {  width: 1.5, color: this.chartRenderingOptions.elevationLineColor },
          fill: {
            type: "linear",
            space: "plot",
            x1: 50, y1: 0, x2: 50, y2: 100,
            colors: [
              { offset: 0.0, color: this.chartRenderingOptions.elevationTopColor },
              { offset: 1.0, color: this.chartRenderingOptions.elevationBottomColor }
            ]
          }
        });

        // RENDER CHART //
        this.profileChart.render();
        deferred.resolve();
      }

      return deferred.promise;
    },

    /**
     * RESIZE PROFILE CHART
     *
     * @private
     */
    _resizeChart: function () {
      if(this.profileChart) {
        this.profileChart.resize();
      }
    },

    /**
     * DISPLAY CHART LOCATION AS RED X GRAPHIC ON MAP
     *
     * @param {Number} chartObjectX
     */
    _displayChartLocation: function (chartObjectX) {
      if(this.map && this.elevationData && this.profilePolyline) {

        if(!this.chartLocationGraphic) {
          // CREATE LOCATION GRAPHIC //
          var red = new Color(Color.named.red);
          var outline = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, red, 3);
          var chartLocationSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_X, 13, outline, red);
          this.chartLocationGraphic = new Graphic(null, chartLocationSymbol); // RED X //
          this.map.graphics.add(this.chartLocationGraphic);
        }

        // SET GEOMETRY OF LOCATION GRAPHIC //
        var distanceIndex = (this.distances) ? array.indexOf(this.distances, chartObjectX) : -1;
        if(distanceIndex >= 0) {
          var elevData = this.elevationData[distanceIndex];
          this.chartLocationGraphic.setGeometry(this.profilePolyline.getPoint(elevData.pathIdx, elevData.pointIdx));
        } else {
          this.chartLocationGraphic.setGeometry(null);
        }
      }
    },

    /**
     * GET DISPLAY VALUE GIVEN A VALUE IN METERS AND THE DISPLAY UNITS
     * CONVERT FROM METERS TO MILES THEN FROM MILES TO DISPLAY UNITS
     *
     * @param {Number} valueMeters
     * @param {String} displayUnits
     */
    _getDisplayValue: function (valueMeters, displayUnits) {
      if(displayUnits === this.measureTool.units.esriMeters) {
        return valueMeters;
      } else {
        var distanceMiles = (valueMeters / this.measureTool.unitDictionary[this.measureTool.units.esriMeters]);
        return (distanceMiles * this.measureTool.unitDictionary[displayUnits]);
      }
    },

    /**
     * GET DISPLAY UNITS
     *
     * @param {Boolean} isElevation
     */
    _getDisplayUnits: function (isElevation) {
      var displayUnits = this.measureTool.unit.label;
      if(isElevation) {
        switch (displayUnits) {
          case this.measureTool.units.esriMiles:
            displayUnits = this.measureTool.units.esriFeet;
            break;
          case this.measureTool.esriYards:
            displayUnits = this.measureTool.esriFeet;
            break;
          case this.measureTool.units.esriKilometers:
            displayUnits = this.measureTool.units.esriMeters;
            break;
        }
      }
      return displayUnits;
    },

    /**
     *
     * @param elevationArray
     * @returns {Array}
     * @private
     */
    _convertElevationsInfoArray: function (elevationArray) {
      var displayUnitsX = this._getDisplayUnits(false);
      var displayUnitsY = this._getDisplayUnits(true);
      return array.map(elevationArray, lang.hitch(this, function (item) {
        return lang.mixin(item, {
          x: this._getDisplayValue(item.x, displayUnitsX),
          y: this._getDisplayValue(item.y, displayUnitsY)
        })
      }));
    },

    /**
     *
     * @param distancesArray
     * @returns {Array}
     * @private
     */
    _convertDistancesArray: function (distancesArray) {
      var displayUnitsX = this._getDisplayUnits(false);
      return array.map(distancesArray, lang.hitch(this, function (distance) {
        return this._getDisplayValue(distance, displayUnitsX);
      }));
    },

    /**
     * CREATE ARRAY OF CERTAIN SIZE WITH CERTAIN VALUE AND ALLOW MULTIPLIER
     * @param size
     * @param value
     * @param asMultiplier
     * @returns {Array}
     * @private
     */
    _getFilledArray: function (size, value, asMultiplier) {
      var dataArray = new Array(size);
      for (var dataIdx = 0; dataIdx < size; ++dataIdx) {
        dataArray[dataIdx] = {
          x: asMultiplier ? (dataIdx * value) : dataIdx,
          y: asMultiplier ? 0.0 : (value || 0.0)
        };
      }
      return dataArray;
    },

    /**
     * RESET Y VALUES IN ARRAY
     *
     * @param dataArray
     * @param value
     * @returns {*}
     * @private
     */
    _resetArray: function (dataArray, value) {
      return array.map(dataArray, function (item) {
        return {
          x: item.x,
          y: value
        }
      });
    },

    /**
     * GET MAXIMUM Y VALUE IN ARRAY
     *
     * @param {[]} dataArray
     * @return {number}
     * @private
     */
    _getArrayMax: function (dataArray) {
      var values = array.map(dataArray, function (item) {
        return item.y;
      });
      return Math.max.apply(Math, values);
    },

    /**
     * GET MINIMUM Y VALUE IN ARRAY
     *
     * @param {[]} dataArray
     * @return {number}
     * @private
     */
    _getArrayMin: function (dataArray) {
      var values = array.map(dataArray, function (item) {
        return item.y;
      });
      return Math.min.apply(Math, values);
    },

    /**
     * DESTROY DIJIT
     */
    destroy: function () {
      this.inherited(arguments);
    }

  });
});




