/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

App.VertexController = App.PollingController.extend(App.Helpers.DisplayHelper, App.ModelRefreshMixin, {
  controllerName: 'VertexController',

  pageTitle: 'Vertex',

  loading: true,
  isActive: false,

  pollingType: 'vertexInfo',

  setup: function () {
    this.set('isActive', true);
  },
  reset: function () {
    this.set('isActive', false);
  },

  pollsterControl: function () {
    if(this.get('dag.status') == 'RUNNING' &&
        this.get('dag.amWebServiceVersion') != '1' &&
        this.get('isActive')) {
      this.get('pollster').start();
    }
    else {
      this.get('pollster').stop();
    }
  }.observes('dag.status', 'dag.amWebServiceVersion', 'isActive'),

  pollsterOptionsObserver: function () {
    var model = this.get('model');

    this.get('pollster').setProperties( (model && model.get('status') != 'SUCCEEDED') ? {
      targetRecords: [model],
      options: {
        appID: this.get('applicationId'),
        dagID: App.Helpers.misc.getIndexFromId(this.get('dagID')),
        vertexID: App.Helpers.misc.getIndexFromId(this.get('id'))
      }
    } : {
      targetRecords: [],
      options: null
    });
  }.observes('applicationId', 'status', 'dagID', 'id'),

  loadAdditional: function(vertex) {
    var loaders = [],
      that = this,
      applicationId = vertex.get('applicationId');

    vertex.set('progress', undefined);

    // Irrespective of am version this will get the progress first.
    if (vertex.get('status') == 'RUNNING') {
      var vertexIdx = vertex.get('id').split('_').splice(-1).pop();
      App.Helpers.misc.removeRecord(this.store, 'vertexProgress', vertexIdx);
      var progressLoader = this.store.find('vertexProgress', vertexIdx, {
        appId: applicationId,
        dagIdx: vertex.get('dagIdx')
      }).then(function(vertexProgressInfo) {
        if (vertexProgressInfo) {
          vertex.set('progress', vertexProgressInfo.get('progress'));
        }
      }).catch(function(error) {
        Em.Logger.error("Failed to fetch vertexProgress" + error)
      });
      loaders.push(progressLoader);
    }

    App.Helpers.misc.removeRecord(that.store, 'appDetail', applicationId);
    var appDetailFetcher = that.store.find('appDetail', applicationId).then(function(appDetail) {
      var appState = appDetail.get('appState');
      if (appState) {
        vertex.set('yarnAppState', appState);
      }
      vertex.set('status', App.Helpers.misc.getRealStatus(vertex.get('status'), appDetail.get('appState'),
        appDetail.get('finalAppStatus')));
    }).catch(function(){});
    loaders.push(appDetailFetcher);

    var tezAppLoader = this.store.find('tezApp', 'tez_' + applicationId)
      .then(function(app){
        vertex.set('tezApp', app);
      }).catch(function(){});
    loaders.push(tezAppLoader);

    var dagFetcher = that.store.find('dag', vertex.get('dagID')).then(function (dag) {
      vertex.set('dag', dag);
    });
    loaders.push(dagFetcher);

    Em.RSVP.allSettled(loaders).then(function(){
      that.set('loading', false);
    });

    return Em.RSVP.all(loaders);
  },

  childDisplayViews: [
    Ember.Object.create({title: 'Vertex Details', linkTo: 'vertex.index'}),
    Ember.Object.create({title: 'Vertex Counters', linkTo: 'vertex.counters'}),
    Ember.Object.create({title: 'Tasks', linkTo: 'vertex.tasks'}),
    Ember.Object.create({title: 'Task Attempts', linkTo: 'vertex.taskAttempts'}),
    Ember.Object.create({title: 'Swimlane', linkTo: 'vertex.swimlane'}),
    Ember.Object.create({title: 'Sources & Sinks', linkTo: 'vertex.additionals'}),
  ],
});
