# Trip distance Splitter for WAB

This is the trip distance splitter built by Interpret Geospatial Solutions. It is to be used with ESRI WAB


## Sample Config

{
  "widgetName": "TripDistanceCalculator",
  "closestFacilityService": "http://dev3.interpret.co.nz/arcgisdev3/rest/services/ECAN_Web_AppBuilder/Canterbury_OSM_ND_Dissolved/NAServer/Closest%20Facility",
  "routeService": "http://dev3.interpret.co.nz/arcgisdev3/rest/services/ECAN_Web_AppBuilder/Canterbury_OSM_ND_Dissolved/NAServer/Route",
  "depotLocs": "1460349.4084,5082561.0188;1558900.7229,5167823.4527;1577887.9281,5222124.0212;1655889.3952,5306371.3995",
  "depotLocs Address, not currently working": "73 Church Street, Timaru;22 Edward Street, Lincoln;5 Markham Street, Amberley;73 Beach Road, Kaikoura",
  "consentsLayer": "http://gis.ecan.govt.nz/arcgis/rest/services/Public/Resource_Consents/MapServer/0",
  "geoCoder": "http://gis.ecan.govt.nz/arcgis/rest/services/Locators/Canterbury_Composite_Locator/GeocodeServer",
  "tripSpliterURL": "/webappbuilder/apps/4/form/result.html?"
}
