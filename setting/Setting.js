define([
  'dojo/_base/declare',
  'jimu/BaseWidgetSetting'
],
function(declare, BaseWidgetSetting) {

  return declare([BaseWidgetSetting], {
    baseClass: 'jimu-widget-demo-setting',

    startup: function(){
      //the config object is passed in
      this.inherited(arguments);
      this.setConfig(this.config);
    },

    setConfig: function(config){
      closestFacilityService.value = config.closestFacilityService;
    },

    getConfig: function(){
      this.config.closestFacilityService = this.closestFacilityService.get('value');
      return this.config
      //WAB will get config object through this method
      // return {
      //   closestFacilityService: this.closestFacilityService.value
      // };
    }
  });
});