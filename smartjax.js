var Smartjax = function() {
	// the actual Smartjax to be returned
	var smartjax={
		//predefined
		defaults:{
			defaultMethod: 'get',
			alwaysForce: false,
			alwaysStore: true,
			defaultStorageName: 'SmartjaxStore'
		},
		//change the defaults
		setDefaults:function (newValues) {
			$.extend(this.defaults,newValues);
		},

		//ajax to handle all request
		ajax: function (requestObj) {
			if(!requestObj.type)
				return helper.fireWithDefaultMethod(requestObj);
			//generating unique requestStoreId
			var requestStoreId = helper.buildRequestStoreId(requestObj);
			//make calls accordingly
			if(!helper.isForce(requestObj) && storeService.isInStore(requestStoreId)){
				return 	helper.returnFromStore(requestStoreId, requestObj.success);
			}
			else{
				if(helper.shouldStore(requestObj))
					return helper.returnWithAddedStore({
						storeId:requestStoreId,
						requestObj:requestObj
					});
				else
					return $.ajax(helper.getOriginalRequestObject(requestObj));
			}
		},
		cleanAll:function () {
			this.cleanStore({clearAll:true});
		},
		cleanStore:function (params) {
			var groups=params.groups;
			var clearAll=params.clearAll;
			if(clearAll===true){
				helper.clearAll();
				return true;
			}
			groupService.clearGroups(groups);
		}
	};

	var helper={
		buildRequestStoreId:function (requestObj) {
			var storeId="";
			var url=requestObj.url;
			//removing slashes
			if(url){
				if(url[0]!=="/")
					storeId+=url[0];
				storeId+=url.substr(1,url.length-2);
				if(url[url.length-1]!=="/")
					storeId+=url[url.length-1];
			}
			if(requestObj.data)
				storeId+=JSON.stringify(requestObj.data);
			return storeId;
		},
		isForce:function (requestObj) {
			if(typeof(requestObj.force)==="boolean")
				return requestObj.force;
			else{
				return smartjax.defaults.alwaysForce;
			}
		},
		shouldStore:function (requestObj) {
			if(typeof(requestObj.store)==="boolean")
				return requestObj.store;
			else{
				return smartjax.defaults.alwaysStore;
			}
		},
		returnWithAddedStore:function(params) {
			var newDeferred= new $.Deferred();
			var requiredRequestObj = this.getOriginalRequestObject(params.requestObj);
			var defaultPromise=$.ajax(requiredRequestObj);
			defaultPromise.done(function (apiResult) {
				storeService.save({
					key:params.storeId,
					value:apiResult
				});
				groupService.registerGroup(params.requestObj,params.storeId);
				newDeferred.resolve(apiResult);
			});
			defaultPromise.fail(function (apiResult) {
				newDeferred.reject(apiResult);
			});
			return newDeferred.promise();
		},
		getOriginalRequestObject:function (requestObj) {
			var request = $.extend({},requestObj);
			delete request.store;
			delete request.force;
			return request;
		},
		returnFromStore:function(key,successCallBck) {
			var newDeferred= new $.Deferred();
			var apiResult = storeService.fetch({
				key:key
			});
			if(successCallBck && typeof(successCallBck)==="function")
				successCallBck();

			newDeferred.resolve(apiResult);
			return newDeferred.promise();
		},
		findBy:function (array,key,value) {
			if(!array || !array.length || !key || !value)
				return null;
			var allMatched = $.grep(array, function(e){
				return e[key] == value;
			});
			if(allMatched && allMatched.length && allMatched[0])
				return allMatched[0];
			else
				return null;
		},
		clearAll:function () {
			var smartjaxStore = storeService.getFullStore();
			var storeIds=smartjaxStore && smartjaxStore.storeIds;
			if(storeIds && storeIds.length){
				storeIds.forEach(function (storeId) {
					storeService.clearStoreId(storeId);
				});
			}
			storeService.setFullStore({});
			console.log("All Smartjax store data cleared");
		}
	};

	var	storeService={
		getFullStore:function (storeName) {
			if(!storeName)
				return JSON.parse(sessionStorage.getItem("SmartjaxStore"));
			else
				return JSON.parse(sessionStorage.getItem(storeName));
		},
		setFullStore:function (storeData,storeName) {
			if(!storeName)
				sessionStorage.setItem("SmartjaxStore", JSON.stringify(storeData));
			else
				sessionStorage.setItem(storeName, JSON.stringify(storeData));
		},
		save:function (reqResToSave) {
			if(typeof(Storage)){
				if(!this.isInStore(reqResToSave.key))
					this.registerNewKey(reqResToSave.key);
				sessionStorage.setItem(reqResToSave.key, JSON.stringify(reqResToSave.value));
			}
		},
		fetch:function (reqResToFetch) {
			var stringResponse= sessionStorage.getItem(reqResToFetch.key);
			return JSON.parse(stringResponse);
		},
		isInStore:function (storeId) {
			var storeIds = this.getFullStore() && this.getFullStore().storeIds;
			if(storeIds && storeIds.length && storeIds.indexOf(storeId)!=-1)
				return true;
			else
				return false;
		},
		registerNewKey:function (key) {
			var smartjaxStore = this.getFullStore();
			if(!smartjaxStore)
				smartjaxStore={};
			if(!smartjaxStore.storeIds || !smartjaxStore.storeIds.length)
				smartjaxStore.storeIds=[];
			smartjaxStore.storeIds.push(key);
			this.setFullStore(smartjaxStore);
		},
		clearStoreId:function (storeId) {
			sessionStorage.removeItem(storeId);
		}
	};

	var groupService={
		registerGroup:function (requestObj,storeId) {
			var group = requestObj.group;
			if(!group)
				return null;
			if(!storeId)
				storeId=helper.buildRequestStoreId(requestObj);

			var smartjaxStore = storeService.getFullStore();
			if(!smartjaxStore)
				smartjaxStore={};
			if(!smartjaxStore.groups || !smartjaxStore.groups.length)
				smartjaxStore.groups=[];
			var selectedGroup=smartjaxStore.groups && helper.findBy(smartjaxStore.groups,'group',requestObj.group);
			if(!selectedGroup){
				selectedGroup={
					group:requestObj.group,
					storeIds:[],
				};
				smartjaxStore.groups.push(selectedGroup);
			}
			if(selectedGroup.storeIds.indexOf(storeId)==-1)
				selectedGroup.storeIds.push(storeId);
			storeService.setFullStore(smartjaxStore);
			return true;
		},
		clearGroupData:function (groupName) {
			var smartjaxStore=storeService.getFullStore();
			var selectedGroup = smartjaxStore.groups && smartjaxStore.groups.length && helper.findBy(smartjaxStore.groups,'group',groupName);
			var mainStoreIds=smartjaxStore.storeIds;
			if(!selectedGroup)
				return false;
			else{
				var storeIds=selectedGroup.storeIds;
				if(storeIds){
					storeIds.forEach(function (storeId) {
						mainStoreIds.splice(mainStoreIds.indexOf(storeId),1);
						storeService.clearStoreId(storeId);
					});
				}
				delete selectedGroup;
				storeService.setFullStore(smartjaxStore);
				console.log("group "+groupName+" cleared from Smartjax store");
			}
		},
		clearGroups:function (groups) {
			if(groups && groups.length){
				groups.forEach($.proxy(function (value) {
					this.clearGroupData(value);
				},this));
			}
		}
	};
return smartjax;
}();
