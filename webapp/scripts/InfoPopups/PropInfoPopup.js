// This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["require", "DQX/base64", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/DocEl", "DQX/Utils", "DQX/Wizard", "DQX/Popup", "DQX/ChannelPlot/GenomePlotter", "DQX/ChannelPlot/ChannelYVals", "DQX/ChannelPlot/ChannelPositions", "DQX/ChannelPlot/ChannelSequence","DQX/DataFetcher/DataFetchers", "DQX/DataFetcher/DataFetcherSummary", "MetaData"],
    function (require, base64, Application, Framework, Controls, Msg, SQL, DocEl, DQX, Wizard, Popup, GenomePlotter, ChannelYVals, ChannelPositions, ChannelSequence, DataFetchers, DataFetcherSummary, MetaData) {

        var PropInfoPopup = {};

        PropInfoPopup.init = function() {
            Msg.listen('',{type:'PropInfoPopup'}, function(scope, settings) {
                PropInfoPopup.show(settings);
            });
        }

        PropInfoPopup.show = function(settings) {
            var propInfo = MetaData.findProperty(settings.tableid, settings.propid);
            var content = '<p>';
            if (propInfo.settings.Description)
             content += '<div style="max-width: 450px">' + propInfo.settings.Description +'</div><p>';

            if (settings.buttons && settings.buttons.length>0) {
                $.each(settings.buttons, function(idx, button) {
                    var handler = button.onChanged;
                    button.setOnChanged(function() {
                        handler();
                        Popup.closeIfNeeded(popupid);
                    });
                    content += button.renderHtml();
                });
                content += '<br>';
            }

            var button_plot = Controls.Button(null, { buttonClass: 'DQXToolButton2', content: 'Create plot', width:120, height:40, bitmap:'Bitmaps/chart.png' }).setOnChanged(function() {
                Msg.send({type: 'CreateDefaultPropertyPlot'}, {
                    tableid: propInfo.tableid,
                    propid: propInfo.propid,
                    query: settings.query
                });
                Popup.closeIfNeeded(popupid);
            });
            content += button_plot.renderHtml();


            var popupid = Popup.create(propInfo.name,content);
        }

        return PropInfoPopup;
    });


