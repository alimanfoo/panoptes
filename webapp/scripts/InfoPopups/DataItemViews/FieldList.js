// This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["require", "DQX/base64", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/SQL", "DQX/DocEl", "DQX/Utils", "DQX/QueryTable", "DQX/Map", "DQX/SVG",
    "DQX/Wizard", "DQX/Popup", "DQX/PopupFrame", "DQX/ChannelPlot/GenomePlotter", "DQX/ChannelPlot/ChannelYVals", "DQX/ChannelPlot/ChannelPositions", "DQX/ChannelPlot/ChannelSequence","DQX/DataFetcher/DataFetchers", "DQX/DataFetcher/DataFetcherSummary",
    "MetaData", "Utils/GetFullDataItemInfo", "Utils/MiscUtils"
],
    function (require, base64, Application, Framework, Controls, Msg, SQL, DocEl, DQX, QueryTable, Map, SVG,
              Wizard, Popup, PopupFrame, GenomePlotter, ChannelYVals, ChannelPositions, ChannelSequence, DataFetchers, DataFetcherSummary,
              MetaData, GetFullDataItemInfo, MiscUtils
        ) {

        var FieldList = {};

        FieldList.create = function(viewSettings, initialItemData) {
            var that = {};
            var tableInfo = MetaData.getTableInfo(initialItemData.tableid);

            that.createFrames = function(parent) {
                that.frameFields = Framework.FrameFinal('', 1).setAllowScrollBars(true,true)
                    .setDisplayTitle(viewSettings.Name);
                parent.addMemberFrame(that.frameFields);
                return that.frameFields;
            };



            that.createPanels = function() {
                that.setContent(initialItemData)
            };

            that.setContent = function(itemData) {
                var parentFieldsMap = {};
                if (itemData.parents)
                    $.each(itemData.parents, function(idx, parentInfo) {
                        parentFieldsMap[parentInfo.tableid] = parentInfo.fields;
                    });
                that.id = DQX.getNextUniqueID();
                var content = '<div id="'+ id + '"style="padding:8px">';
                if (viewSettings.Introduction)
                    content += viewSettings.Introduction+'<p>';
                content += "<table>";
                var fieldContent = '';
                $.each(viewSettings.Fields, function(idx, propid) {
                    var lnk = null;
                    if (propid.indexOf('@')<0) {//property from this table
                        var propInfo = MetaData.findProperty(tableInfo.id, propid);
                        fieldContent = itemData.fields[propid];
                        if (propInfo.relationParentTableId) {
                            var lnk = Controls.Hyperlink(null,{ content: '<span class="fa fa-external-link-square" style="font-size: 120%"></span> <b>Open</b>'});
                            lnk.setOnChanged(function() {
                                Msg.send({type: 'ItemPopup'}, {
                                    tableid: propInfo.relationParentTableId,
                                    itemid: itemData.fields[propid]
                                });
                            });
                        }
                    }
                    else {//property from a parent table
                        var parenttableid = propid.split('@')[1];
                        propid = propid.split('@')[0];
                        var propInfo = MetaData.findProperty(parenttableid, propid);
                        if (!parentFieldsMap[parenttableid])
                            DQX.reportError('Missing parent item data for '+parenttableid);
                        fieldContent = parentFieldsMap[parenttableid][propid];
                    }
                    content += '<tr>';
                    content += '<td style="padding-bottom:3px;padding-top:3px;white-space:nowrap" title="{hint}"><b>{name}</b></td>'.DQXformat({
                        hint: (propInfo.settings.Description)||'',
                        name: propInfo.name
                    });
                    content += '<td style="padding-left:5px;word-wrap:break-word;">';
                    content += propInfo.toDisplayString(fieldContent);
                    if (lnk) {
                        content += '&nbsp;&nbsp;&nbsp;';
                        content += lnk.renderHtml();
                    }
                    content += "</td>";
                    content += "</tr>";
                });
                content += "</table>";
                content += "</div>";

                that.frameFields.setContentHtml(content);
            };

            that.update = function(newItemData) {
                $('#'+that.id).remove();
                that.setContent(newItemData);
            };

            that.onClose = function() {
            }

            return that;
        }

        return FieldList;
    });



