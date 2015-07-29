// Written By Hamish Kingsbury (Interpret Geospatial Solutions) for Environment Canterbury. This widget
// is to be used in conjunction with ESRIs Web App Builder.

// allows for the easy toggling of div tags
function toggle_visibility(id, display) {
    var e = document.getElementById(id);
    if (display == 'hide'){
        e.style.display = 'none';
    }else if (display == 'show'){
        e.style.display = 'block';
    }
    else{}
};

// gets the parameters from the URL
QueryString = function () {
  var query_string = {};
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
        // If first entry with this name
    if (typeof query_string[pair[0]] === "undefined") {
        if ((pair[0] === 'tripID') || (pair[0].indexOf('crc') > -1) || (pair[0].indexOf('CRC')> -1)){
            query_string[pair[0]] = pair[1];
        }      
        // If second entry with this name
    } else if (typeof query_string[pair[0]] === "string") {
      var arr = [ query_string[pair[0]], pair[1] ];
      query_string[pair[0]] = arr;
        // If third or later entry with this name
    } else {
      query_string[pair[0]].push(pair[1]);
    }
  } 
    return query_string;
} ();

define(['dojo/_base/declare', 'jimu/BaseWidget',

    "esri/tasks/ClosestFacilityTask", "esri/tasks/ClosestFacilityParameters",

    "esri/tasks/FeatureSet", "esri/layers/GraphicsLayer", "esri/renderers/SimpleRenderer",
    "esri/symbols/SimpleMarkerSymbol", "esri/symbols/SimpleLineSymbol",

    "esri/graphic", "esri/geometry/Point", "esri/Color",

    "esri/tasks/query", "esri/tasks/QueryTask",

    "esri/tasks/RouteTask", "esri/tasks/RouteParameters", "esri/tasks/locator",

    "dojo/_base/lang","dojo/promise/all","dojo/dom-construct",

    "esri/dijit/Geocoder",

    "dojo/_base/array"],

function(declare, BaseWidget,

    ClosestFacilityTask, ClosestFacilityParameters,

    FeatureSet, GraphicsLayer, SimpleRenderer,
    SimpleMarkerSymbol, SimpleLineSymbol,
    
    Graphic, Point, Color,

    Query, QueryTask,

    RouteTask, RouteParams, Locator,

    lang, all, domConstruct,

    Geocoder,

    array) {


    // This holds the results and is sent back to the trip spliter
    tripSplitResult = { "tripID":0,
                        "totalDist":0,
                        "consents":[],
                        "closestDepot":[],
                        "depotDist":[],
                        "chargeable":[]
                      };

    URLconsents = [];
    for (var key in QueryString ) {
        if (key == 'tripID'){
            // Gets the tripID from the URL
            tripSplitResult['tripID'] = QueryString['tripID']
        } else if (QueryString.hasOwnProperty(key)) {
        // Puts all the consent codes into an array
        URLconsents.push(QueryString[key]);
      }
    }

////////////////////////////////////////////////////////////
// The following are here so they can be accessed by more //
// than one function.                                     //
////////////////////////////////////////////////////////////

    currentConsents =[];

// general point symbol, used for the hard coded depot locations
    var PointSymbol = new SimpleMarkerSymbol(
          SimpleMarkerSymbol.STYLE_DIAMOND, 
          20,
          new SimpleLineSymbol(
            SimpleLineSymbol.STYLE_SOLID,
            new Color([89,95,35]), 2
          ),
          new Color([166,226,46,.5])
        ); 

// point symbol for consents when they're added to the map
    var ConsentSymbol = new SimpleMarkerSymbol(
      SimpleMarkerSymbol.STYLE_SQUARE, 
      20,
      new SimpleLineSymbol(
        SimpleLineSymbol.STYLE_SOLID,
        new Color([89,95,35]), 2
      ),
      new Color([130,159,83,1])
    ); 

// setup up the layer and associated properties for displaying
// the consents and the start and end locations of the route.
    var consentRenderer = new SimpleRenderer(ConsentSymbol);
    var startEndRenderer = new SimpleRenderer(PointSymbol);
    var Renderer = new SimpleRenderer(PointSymbol);

    // layer to show chosen consent locations
    consentLoclayer = new GraphicsLayer();
    var consentLoc = new FeatureSet();
    consentLoclayer.setRenderer(consentRenderer);

    // array to hold attribute information
    consentLocattr = [];

    // Spatial reference of the map
    sRef = _viewerMap.__tileInfo.spatialReference;


  //To create a widget, you need to derive from BaseWidget.
  return declare([BaseWidget], {
    baseClass: 'calculate',


    //methods to communication with app container:
    postCreate: function() {
        this.inherited(arguments);
        console.log('Calculate::postCreate');
    },

// This function works out which depot is the closest for each point
    closest: function() {
        // make sure the result div is empty
        document.getElementById("results").innerHTML = '';

        // show loading image
        toggle_visibility('calcloading','show');

        // setup closest facility parameters
        var params = new ClosestFacilityParameters();
        params.impedenceAttribute= "length";            
        params.returnIncidents=true;
        params.returnRoutes=false;
        params.returnDirections=true;
        params.outSpatialReference = sRef;
        var closestFacilityTask = new ClosestFacilityTask(this.config.closestFacilityService);

        // add the facilities (depots)
        var facilities = new FeatureSet();
        facilities.features = facilitiesGraphicsLayer.graphics;
        params.facilities = facilities;

        // add the incidents (consent locations)
        var incidentsGraphicsLayer = new GraphicsLayer();
        incidentsGraphicsLayer.setRenderer(Renderer);
        var incidents = new FeatureSet();
        incidents.features = consentLoclayer.graphics;
        params.incidents = incidents;

        // solve the closestFacilityTask
        var taskResults = closestFacilityTask.solve(params,lang.hitch(this,function(solveResult){
            var resultString = "<br>"

            // format strings
            function string(addition){
                resultString = resultString + addition;
                return resultString
            };

            // transcode id to string of depot
            function depot(number){
                if (number == '1'){
                    return 'Timaru';
                } else if (number == '2'){
                    return 'Christchurch';
                } else if (number == '3'){
                    return 'Amberley';
                } else {
                    return 'Kaikoura';
                }
            };

            // transcode concent id to string
            function CRCid(CRCindex){
                return consentLocattr[CRCindex][1];
            };

            var timaruDepot =[];
            var christchurchDepot=[];
            var amberleyDepot=[];
            var kaikouraDepot=[];

            // iterate through results and prepare to display them.
            tripSplitResult['consents']=[];
            tripSplitResult['closestDepot']=[];
            tripSplitResult['depotDist']=[];
            for (i in solveResult.directions){
                results = solveResult.directions[i];

                // the following adds the consent to its corresponding depot
                if (results.routeName.split(' ')[4] === '1'){
                    timaruDepot.push([((results.routeName.split(' ')[1])-1),CRCid((results.routeName.split(' ')[1])-1)])
                }
                if (results.routeName.split(' ')[4] === '2'){
                    christchurchDepot.push([((results.routeName.split(' ')[1])-1),CRCid((results.routeName.split(' ')[1])-1)])
                }
                if (results.routeName.split(' ')[4] === '3'){
                    amberleyDepot.push([((results.routeName.split(' ')[1])-1),CRCid((results.routeName.split(' ')[1])-1)])
                }
                if (results.routeName.split(' ')[4] === '4'){
                    kaikouraDepot.push([((results.routeName.split(' ')[1])-1),CRCid((results.routeName.split(' ')[1])-1)])
                }
                
                string("<p>Consent Number ");
                string(CRCid((results.routeName.split(' ')[1])-1));
                string(" is ");
                string(((Math.round(results.totalLength*100))/100).toFixed(1));
                string("km (oneway) from the ");
                string(depot(results.routeName.split(' ')[4]));
                string(" depot.</p>");
                tripSplitResult['consents'].push(CRCid((results.routeName.split(' ')[1])-1));
                tripSplitResult['closestDepot'].push(depot(results.routeName.split(' ')[4]));
                tripSplitResult['depotDist'].push(((Math.round(results.totalLength*100))/100).toFixed(1));
            };
            var allDepots = [timaruDepot,christchurchDepot,amberleyDepot,kaikouraDepot];
            this.excess(allDepots)
            // display resutls in a div element.
            document.getElementById("results").innerHTML =resultString;
        }));
    },

    excess: function(consents) {
        // calculates the 'excess' or 'slop' from the routes

        var timaruRoute = [];
        var christchurchRoute = [];
        var amberleyRoute = [];
        var kaikouraRoute = [];

        // add all the consent locations to a list so they can be iterated through a route solve
        for (i in consents){
            if (consents[i].length === 0){
            } else {
                try{ // will halt if it doesnt find an index (i.e. no consent)
                    for (j in consents[i]){
                        if (i == 0){
                            timaruRoute.push(consentLocattr[consents[i][j][0]][2])
                        } else if(i == 1){
                            christchurchRoute.push(consentLocattr[consents[i][j][0]][2])
                        } else if(i == 2){
                            amberleyRoute.push(consentLocattr[consents[i][j][0]][2])
                        } else {
                            kaikouraRoute.push(consentLocattr[consents[i][j][0]][2])
                        }
                    }
                }catch(e){}
            }
        }
        var allRoutes = [timaruRoute,christchurchRoute,amberleyRoute,kaikouraRoute]

        eRoute = new RouteTask(this.config.routeService);
        eParams = new RouteParams;

        eParams.outSpatialReference = sRef;
        eParams.returnRoutes = false;
        eParams.returnDirections = true;
        eParams.findBestSequence = true;
        eParams.preserveFirstStop = true;
        eParams.preserveLastStop = true;
        eParams.useHierarchy = true;
        slop = 0
        eRoute.on('solve-complete',function(evt){
            var totalDist = (((Math.round(evt.result.routeResults[0].directions.totalLength*100))/100).toFixed(1));
            slop = slop + Number(totalDist);
            tripSplitResult['chargeable']=slop;
            document.getElementById("chargeable").innerHTML = '<p>Chargeable Distance is ' + slop +'km.</p>'
        });

        for (i in allRoutes){
            if (allRoutes[i].length === 0){
                console.log('no consents')
            } else {
                if (i == 0){ // Timaru
                    eParams.stops = new FeatureSet();
                    stops = []
                    //start
                    stops.push(depotGraphic[0])
                    for (j in allRoutes[i])
                        //consents
                        stops.push(allRoutes[i][j]);
                    //end
                    stops.push(depotGraphic[0])
                    eParams.stops.features = stops;
                    eRoute.solve(eParams);

                } else if (i == 1){ // Christchurch
                    eParams.stops = new FeatureSet();
                    stops = []
                    //start
                    stops.push(depotGraphic[1])
                    for (j in allRoutes[i])
                        //consents
                        stops.push(allRoutes[i][j]);
                    //end
                    stops.push(depotGraphic[1])
                    eParams.stops.features = stops;
                    eRoute.solve(eParams);
                } else if (i == 2){ // Amberbley
                    eParams.stops = new FeatureSet();
                    stops = []
                    //start
                    stops.push(depotGraphic[2])
                    for (j in allRoutes[i])
                        //consents
                        stops.push(allRoutes[i][j]);
                    //end
                    stops.push(depotGraphic[2])
                    eParams.stops.features = stops;
                    eRoute.solve(eParams);
                } else {
                    eParams.stops = new FeatureSet();
                    stops = []
                    //start
                    stops.push(depotGraphic[3])
                    for (j in allRoutes[i])
                        //consents
                        stops.push(allRoutes[i][j]);
                    //end
                    stops.push(depotGraphic[3])
                    eParams.stops.features = stops;
                    eRoute.solve(eParams);
                }
            }
        }


    },

    search: function() {
        toggle_visibility('addLoc','hide');
        // initalize the query for finding consents
        var queryTask = new QueryTask(this.config.consentsLayer);
        query = new Query();
        query.returnGeometry = true;
        query.outSpatialReference = sRef;
        query.outFields = ["ConsentNo","ActivityText","Location"];
        query.text = document.getElementById("searchText").value;

        // run query
        queryTask.execute(query, lang.hitch(this,function(results){
            toggle_visibility('addLoc','show');
            findresults = results;
            this.map.centerAndZoom(new Point(findresults.features[0].geometry.x,findresults.features[0].geometry.y,sRef),11);

            // see if consent has already been visited, if so disable button
            if (currentConsents.indexOf(findresults.features[0].attributes.ConsentNo) == -1 ){
                document.getElementById("addButton").disabled = false;
            } else{
                document.getElementById("addButton").disabled = true; 
            }

            // push results to an array
            resultItems = [];
            resultCount = results.features.length;
            for (var i = 0; i < 1; i++) {
                featureAttributes = results.features[i].attributes;
                for (var attr in featureAttributes) {
                    resultItems.push("<p><b>" + attr + ": </b>" + featureAttributes[attr] + "</p>");
                }   
            }
            document.getElementById("info").innerHTML = resultItems.join("");
        }));

    },    

    searchURL: function(crc) {
        // This is similar to the above function, but is
        // run when consents are passed through in the URL
        toggle_visibility('addLoc','hide');

        // initalize the query for finding consents. 
        var queryTask = new QueryTask(this.config.consentsLayer);
        var query = new Query();
        query.returnGeometry = true;
        query.outSpatialReference = {wkid:2193}; 
        query.outFields = ["ConsentNo","ActivityText","Location"];
        query.text = crc;

        // run query
        queryTask.execute(query, lang.hitch(this,function(results){
            toggle_visibility('addLoc','show');
            findresults = results;
            this.consentDisplay();
        }));

    },

    consentDisplay: function() {
        // This function displays the consents on the map and in the widget
        toggle_visibility('currentloading','show');
        numConsent = (URLconsents.length);

        document.getElementById("addButton").disabled = true; 
        consentLoclayer.add(new Graphic(new Point(findresults.features[0].geometry.x,findresults.features[0].geometry.y,sRef)));
        consentLocattr.push([(consentLoclayer.graphics.length-1),findresults.features[0].attributes.ConsentNo,(new Graphic(new Point(findresults.features[0].geometry.x,findresults.features[0].geometry.y,sRef)))]);
        consentLoc.features = consentLoclayer.graphics;

        // if consents are specified in the url, don't zoom to them
        if (URLconsents[0] == undefined){
            this.map.centerAndZoom(new Point(findresults.features[0].geometry.x,findresults.features[0].geometry.y,sRef),11)
        }

        // setting up the output string
        var string = '';
        currentConsents =[]

        function consentDelete() {
            console.info(evt.target.id);
        }

        for (i in consentLocattr){
            string = '<div id="consent'+i+'"><p>' + consentLocattr[i][1] + '</p></div>';
            currentConsents.push(consentLocattr[i][1]);

        }
        toggle_visibility('current','show');
        document.getElementById("current").innerHTML = document.getElementById("current").innerHTML + string; 
        this.map.addLayer(consentLoclayer);

        if (consentLocattr.length >= numConsent){
            toggle_visibility('currentloading','hide');
        }
    },


    location: function(){
        if (consentGeocoder.results[0] === undefined){
            alert('Please Enter an Address');
        } else {
            this.map.centerAndZoom(new Point(consentSearchLoc[0].feature.geometry.x,consentSearchLoc[0].feature.geometry.y,sRef),11);
            consentLoclayer.add(new Graphic(new Point(consentSearchLoc[0].feature.geometry.x,consentSearchLoc[0].feature.geometry.y,sRef)));
            this.map.addLayer(consentLoclayer);
            currentConsents.push(consentSearchLoc[0].name);
            consentLocattr.push([(consentLoclayer.graphics.length-1),consentSearchLoc[0].name,(new Graphic(new Point(consentSearchLoc[0].feature.geometry.x,consentSearchLoc[0].feature.geometry.y,sRef)))]);
            consentLoc.features = consentLoclayer.graphics;
            toggle_visibility('current','show');
            i = currentConsents.length-1
            document.getElementById("current").innerHTML = document.getElementById("current").innerHTML +'<p>'+ consentSearchLoc[0].name +'</p>';
        }
    },

    clear: function() {
        // clear the map and all input fields ect
        // doesn't clear consent locations if they have be taken from the URL
        if (URLconsents[0] == undefined){
            try {
            _viewerMap._layers.graphicsLayer1.clear();
            } catch(e){}
            consentLocattr = [];
            consentLoc = new FeatureSet();
            currentConsents = [];
            document.getElementById("current").innerHTML = '<h2>Current Locations</h2>';
            toggle_visibility('current','hide');
            document.getElementById("info").innerHTML = '';
            toggle_visibility('addLoc','hide');
            document.getElementById("searchText").value = 'CRC';
        }
        try {
                _viewerMap._layers.graphicsLayer2.clear();
        } catch(e){}
        try {
        _viewerMap._layers.map_graphics.clear();
        } catch(e){}

        startLoc = [];
        endLoc = [];
        document.getElementById("routeResult").innerHTML = '';
        document.getElementById("results").innerHTML = '';
        document.getElementById("chargeable").innerHTML = '';
        tripSplitResult = {"tripID":0,"totalDist":0,"consents":[],"closestDepot":[],"depotDist":[],"chargeable":[]
    };
    },

    route: function(){
        error = false
        try {
            _viewerMap._layers.graphicsLayer2.clear();
        } catch(e){}

        if((startGeocoder.results.length === 0) && (document.getElementById("startSelect").value === 'default')){
            toggle_visibility('startError','show')
        } 
        if((startGeocoder.results.length !== 0) && (document.getElementById("startSelect").value === 'default')){
            toggle_visibility('startError','hide')
        }
        if((startGeocoder.results.length !== 0) && (document.getElementById("startSelect").value !== 'default')){
            alert('Please enter one location or depot to start at.')
            error = true
        }
        if((endGeocoder.results.length === 0) && (document.getElementById("endSelect").value === 'default')){
            toggle_visibility('endError','show')
        } 
        if((endGeocoder.results.length !== 0) && (document.getElementById("endSelect").value === 'default')){
            toggle_visibility('endError','hide')
        }
        if((endGeocoder.results.length !== 0) && (document.getElementById("endSelect").value !== 'default')){
            alert('Please enter one location or depot to end at.')
            error = true
        }
        // if no start/end or consent location is found, alert the user
        if (currentConsents.length === 0 || ((startGeocoder.results.length === 0) && (document.getElementById("startSelect").value === 'default')) || ((endGeocoder.results.length === 0) && (document.getElementById("endSelect").value === 'default'))){
            alert('Please make sure you have entered a Start and End location as well as one or more consents')
        } else if (error === true){

        } else{
            toggle_visibility('endError','hide')
            toggle_visibility('startError','hide')
            toggle_visibility('calcloading','show');

            // clear existing routes
            _viewerMap._layers.map_graphics.clear();
            document.getElementById("routeResult").innerHTML = '';

            // calculate the closest depots
            this.closest();

            if (document.getElementById('startSelect').value !== 'default'){
                if (document.getElementById('startSelect').value === 'Timaru'){
                    var startLoc = [depotGraphic[0].geometry.x,depotGraphic[0].geometry.y];
                } else if (document.getElementById('startSelect').value === 'Christchurch'){
                    var startLoc = [depotGraphic[1].geometry.x,depotGraphic[1].geometry.y];
                } else if (document.getElementById('startSelect').value === 'Amberley'){
                    var startLoc = [depotGraphic[2].geometry.x,depotGraphic[2].geometry.y];
                } else {
                    var startLoc = [depotGraphic[3].geometry.x,depotGraphic[3].geometry.y]
                }
            } else {
                var startLoc = [startSearchLoc[0],startSearchLoc[1]];
                
            }

            if (document.getElementById('endSelect').value !== 'default'){
                if (document.getElementById('endSelect').value === 'Timaru'){
                    var endLoc = [depotGraphic[0].geometry.x,depotGraphic[0].geometry.y];
                } else if (document.getElementById('endSelect').value === 'Christchurch'){
                    var endLoc = [depotGraphic[1].geometry.x,depotGraphic[1].geometry.y];
                } else if (document.getElementById('endSelect').value === 'Amberley'){
                    var endLoc = [depotGraphic[2].geometry.x,depotGraphic[2].geometry.y];
                } else {
                   var endLoc = [depotGraphic[3].geometry.x,depotGraphic[3].geometry.y];
                }
            } else {
                var endLoc = [endSearchLoc[0],endSearchLoc[1]];
                
            }

            // add geocoded locations to layer (start/end)
            startEndlayer.add(new Graphic(new Point(startLoc[0],startLoc[1],sRef)));
            startEndlayer.add(new Graphic(new Point(endLoc[0],endLoc[1],sRef)));
            this.map.addLayer(startEndlayer);

            // setup route parameters
            var routeTask = new RouteTask(this.config.routeService);
            var routeParams = new RouteParams();
            routeParams.stops = new FeatureSet();
            routeParams.outSpatialReference = sRef;
            routeParams.returnRoutes = true;
            routeParams.returnDirections = true;
            routeParams.findBestSequence = true;
            routeParams.preserveFirstStop = true;
            routeParams.preserveLastStop = true;
            routeParams.useHierarchy = true;

            // populate stops
            stops = [];
            stops.push(startEndlayer.graphics[0]);
            for (i in consentLoclayer.graphics){
                stops.push(consentLoclayer.graphics[i]);
            }
            stops.push(startEndlayer.graphics[1]);
            routeParams.stops.features = stops;

            // solve route
            routeTask.solve(routeParams);
            routeTask.on("solve-complete", lang.hitch(this,function(evt){
                var routeSymbol = new SimpleLineSymbol().setColor(new Color([0, 0, 255, 0.5])).setWidth(5);
                var totalDist = (((Math.round(evt.result.routeResults[0].directions.totalLength*100))/100).toFixed(1));
                tripSplitResult['totalDist'] = totalDist;

                document.getElementById("routeResult").innerHTML = "<p>Total Distance is "+totalDist+"kms.</p>";

                var route = evt.result.routeResults[0].route.setSymbol(routeSymbol);
                this.map.graphics.add(route);
                this.map.setExtent(evt.result.routeResults[0].directions.extent,true);
                toggle_visibility('calcloading','hide');
            }));

            // if no consents are specified in the URL, disable the button to return to the Trip Spliter.
            if (URLconsents[0] !== undefined){
                document.getElementById('return').disabled = false;
            }
        }
    },

    return: function(){
        // sets up the URL to send back to the trip spliter
        url = this.config.tripSpliterURL;
        get ='tripID='+tripSplitResult['tripID']+'&totalDist='+tripSplitResult['totalDist'];
        for (i in tripSplitResult['consents']){
            get = get +'&crc'+i+'='+tripSplitResult['consents'][i];
            get = get +'&crcDepot'+i+'='+tripSplitResult['closestDepot'][i];
            get = get +'&crcDepotDist'+i+'='+tripSplitResult['depotDist'][i];
        }
        get = get +'&chargeable='+tripSplitResult['chargeable'];
        url = url+get;
        var win = window.open(url, '_blank');
        win.focus();
    },


    startup: function(){

        // layer to show start/end locations
        startEndlayer = new GraphicsLayer();
        startEndlayer.setRenderer(startEndRenderer);


        // On widget startup, detects any present consents in the URL
        if ((URLconsents.length > 0) && (URLconsents[0] !== undefined)){
            toggle_visibility('CRC Search', 'hide');
            for (i in URLconsents){
                this.searchURL(URLconsents[i]);
            }
        } else {
            console.log('No Url CRCs')
        }

        // setup the three different geocoders. One for start locations
        // one for end locations and the last ass an alternative for entering a consent

        // hard code the four depot locations
        facilitiesGraphicsLayer = new GraphicsLayer();
        facilitiesGraphicsLayer.setRenderer(Renderer);

        // contains graphics of each depot
        depotGraphic = [];

        // add the locations to a layer
        // var depotLocs= ["73 Church Street, Timaru","22 Edward Street, Lincoln", "5 Markham Street, Amberley", "73 Beach Road, Kaikoura"];
        // test = []
        // for (i in depotLocs){
        //                 setTimeout(lang.hitch(this,function(){
        //     test.push = this.depotAddress(depotLocs[i])
        //             }),1000)
        // }
        // console.log(test)

        var locs = this.config.depotLocs.split(';')
        depotLocs = []
        for (i in locs){
            l=[]
            for (j in locs[i].split(',')){
                l.push(parseFloat(locs[i].split(',')[j]))
            }
            depotLocs.push(l)
        }
        // depotLocs = ["73 Church Street, Timaru","22 Edward Street, Lincoln","5 Markham Street, Amberley","73 Beach Road, Kaikoura"]

        // for (i in depotLocs) {  
        //             // var locator = new esri.tasks.Locator(this.config.geoCoder);
        //     // locator.outSpatialReference = sRef;
        //     // var optionsFrom = {
        //     //     address: { "SingleLine": depotLocs[i] },
        //     //     outFields: ["Loc_name"]
        //     // };
           
        //     // locator.addressToLocations(optionsFrom,function(candidate){
        //     //     var r = candidate;
        //     //     facilitiesGraphicsLayer.add(new Graphic(new Point(r[0].location.x,r[0].location.y,sRef)));
        //     //     depotGraphic.push(new Graphic(new Point(r[0].location.x,r[0].location.y,sRef)));
        //     //     });   

        for (i in depotLocs) {          
            depotGraphic.push(new Graphic(new Point(depotLocs[i][0],depotLocs[i][1],sRef)));
            facilitiesGraphicsLayer.add(new Graphic(new Point(depotLocs[i][0],depotLocs[i][1],sRef)));
        }

        startGeocoder = new Geocoder({
            arcgisGeocoder: false,
            geocoders:[{
                url: this.config.geoCoder,
                name: 'ECAN Geocoder',
                singleLineFieldName: "SingleLine",
                placeholder: 'Locate',
                outFields: "*"
            }],
            autoComplete: true,
            autoNavigate: false,
            map: this.map,
        }, document.getElementById('startSearch'));

        startGeocoder.on('select',function(evt){
            startSearchLoc =[evt.result.feature.geometry.x,evt.result.feature.geometry.y]
        })

        endGeocoder = new Geocoder({
            arcgisGeocoder: false,
            geocoders:[{
                url: this.config.geoCoder,
                name: 'ECAN Geocoder',
                singleLineFieldName: "SingleLine",
                placeholder: 'Locate',
                outFields: "*"
            }],
            autoComplete: true,
            autoNavigate: false,
            map: this.map,
        }, document.getElementById('endSearch'));

        endGeocoder.on('select',function(evt){
            endSearchLoc =[evt.result.feature.geometry.x,evt.result.feature.geometry.y]
        })

        consentGeocoder = new Geocoder({
            arcgisGeocoder: false,
            geocoders:[{
                url: this.config.geoCoder,
                name: 'ECAN Geocoder',
                singleLineFieldName: "SingleLine",
                placeholder: 'Locate',
                outFields: "*"
            }],
            autoComplete: true,
            autoNavigate: false,
            map: this.map,
        }, document.getElementById('consentSearch'));

        consentGeocoder.on('select',function(evt){
            consentSearchLoc =[evt.result,evt.result]
        })

        consentGeocoder.startup();
        startGeocoder.startup();
        endGeocoder.startup();
    }
  });
});
