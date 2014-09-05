// This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
// This program is free software licensed under the GNU Affero General Public License. 
// You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>
define(["require", "_", "d3", "blob", "filesaver", "DQX/Model", "DQX/SQL", "DQX/Framework", "DQX/ArrayBufferClient", "DQX/Controls", "DQX/Msg", "DQX/Utils",
    "DQX/ChannelPlot/ChannelCanvas", "Utils/QueryTool", "Utils/Serialise", "MetaData", "Views/Genotypes/Model",
     "Views/Genotypes/View"],
    function (require, _, d3, Blob, FileSaver, DQXModel, SQL, Framework, ArrayBufferClient,
              Controls, Msg, DQX, ChannelCanvas, QueryTool, Serialise, MetaData, Model,
               View) {

        var GenotypeChannel = {};

        GenotypeChannel.Channel = function (table_info, controls_group, parent) {
            var id = table_info.id+'_genotypes';
            var that = ChannelCanvas.Base(id);

            that.init = function(table_info, controls_group, parent) {
                that._height = 400;
                that._toolTipHandler = null;
                that._clickHandler = null;
                that._always_call_draw = true;
                that._title = table_info.name;
                that.parent_browser = parent;
                that.table_info = table_info;

                that.rowTableInfo = that.table_info.row_table;


                var model_params = DQXModel({
                  col_query: SQL.WhereClause.Trivial(),
                  row_query: SQL.WhereClause.Trivial(),
                  col_order: table_info.col_table.PositionField,
                  row_order: table_info.row_table.primkey,
                  width_mode:'auto',
                  user_column_width: 1,
                  page_length: 50,
                  page: 1
                });

                that.model = Model(table_info,
                                   _.map(MetaData.chromosomes, DQX.attr('id')),
                                   that._draw,
                                   model_params.get()
                );

                //Create controls
                that.download_button = Controls.Button(null, {content:'Download View', buttonClass: 'PnButtonGrid', width:120, height:30, icon:'fa-download'})
                .setOnChanged(that.download_view);

                var view_controls = Controls.CompoundVert([]);
                view_controls.addControl(that.createVisibilityControl());
                view_controls.addControl(Controls.VerticalSeparator(3));

                var view_params = DQXModel({
                  samples_property:that.rowTableInfo.primkey,
                  row_height:11,
                  alpha_channel:(that.model.settings.ExtraProperties &&
                    that.model.settings.ExtraProperties[0] ?
                    that.model.settings.ExtraProperties[0] : '__null'),
                  height_channel:(that.model.settings.ExtraProperties &&
                    that.model.settings.ExtraProperties[1] ?
                    that.model.settings.ExtraProperties[1] : '__null')
                });

                view_params.on({}, function() {
                    that.view.update_params(this.get());
                    //None of these controls change the horizontal region so it is safe to just call the internal redraw.
                    that._draw();
                });
                model_params.on({}, function() {
                    that.model.update_params(this.get());
                    //Call the full draw as we need to refresh data and column placement
                    that.draw(that.draw_info);
                });

                var states = [];
                $.each(that.rowTableInfo.propertyGroups, function(idx1, propertyGroup) {
                    $.each(propertyGroup.properties, function(idx2, propInfo) {
                        if (propInfo.settings.showInTable || propInfo.isPrimKey)
                            states.push({id: propInfo.propid, name: propInfo.name})
                    });
                });

                var controlsGridData = [];

                var controlWidth = 125;

                var sampleProperty_channel = Controls.Combo(null, { label:'', states:states, width:controlWidth})
                    .bindToModel(view_params, 'samples_property').setClassID(that.table_info.id + 'SamplesLabel');

                var buttonSortSamplesByField = Controls.Hyperlink(null, {content: '&nbsp;<span class="fa fa-sort-amount-asc" style="font-size:110%"></span>&nbsp;'}).setOnChanged(function() {
                      model_params.set('row_order', view_params.get('samples_property'));
                });

                controlsGridData.push({ label:'Label', ctrl: Controls.CompoundHor([sampleProperty_channel, Controls.HorizontalSeparator(2), buttonSortSamplesByField]) })

                var states = _.map(that.model.settings.ExtraProperties, function(prop) {
                    return {id:prop, name:that.table_info.properties[prop].name};
                });
                states.push({id:'__null', name:'None'});
                var alpha_channel = Controls.Combo(null, { label:'', states:states, width:controlWidth })
                    .bindToModel(view_params, 'alpha_channel').setClassID(that.table_info.id + 'ChannelAlpha');
                controlsGridData.push({ label:'Alpha', ctrl: alpha_channel })
                var height_channel = Controls.Combo(null, { label:'', states:states, width:controlWidth })
                    .bindToModel(view_params, 'height_channel').setClassID(that.table_info.id + 'ChannelHeight');
                controlsGridData.push({ label:'Height', ctrl: height_channel })

                var states = [{id:'auto', name:'Automatic width'}, {id:'fill', name:'Fill Width'}, {id:'manual', name:'Manual Width'}];
                var width_mode = Controls.Combo(null, { label:'', states:states, width:controlWidth })
                    .bindToModel(model_params, 'width_mode').setClassID(that.table_info.id + 'ColumnMode');
                controlsGridData.push({ label:'Columns', ctrl: width_mode })

                var column_width = Controls.ValueSlider(null, {label: 'Manual Column Width', width:(controlWidth+75), minval:1, maxval:150, scaleDistance: 20, value:model_params.get('user_column_width')})
                    .bindToModel(model_params, 'user_column_width').setClassID(that.table_info.id + 'ColumnWidth');
                var show_hide_width = Controls.ShowHide(column_width);
                model_params.on({change:'width_mode'}, function() {
                  show_hide_width.setVisible(this.get('width_mode') == 'manual');
                });
                show_hide_width.setVisible(false);

                var page_length = Controls.Edit(null, { label:'', size:5 });
                page_length.bindToModel(model_params, 'page_length', function(input) {
                    var num = parseInt(input);
                    if (num != num) //Check for NaN
                        return 0;
                    else
                        return num;
                });
                controlsGridData.push({ label:'Page size', ctrl: page_length })


                var controlsGrid = Controls.CompoundGrid().setSeparation(2,4);
                $.each(controlsGridData, function(idx, item) {
                    controlsGrid.setItem(idx, 0, Controls.Static('<span class="DescriptionText">'+item.label+':</span>'));
                    controlsGrid.setItem(idx, 1, item.ctrl);
                });
                view_controls.addControl(controlsGrid);

                view_controls.addControl(show_hide_width);

                view_controls.addControl(Controls.VerticalSeparator(3));
                var row_height = Controls.ValueSlider(null, {label: 'Row Height:', width:(controlWidth+75), minval:1, maxval:20, scaleDistance: 5, value:view_params.get('row_height')})
                    .bindToModel(view_params, 'row_height').setClassID(that.table_info.id + 'RowHeight');
                view_controls.addControl(row_height);

                view_controls.addControl(Controls.VerticalSeparator(15));
                view_controls.addControl(that.download_button);

                that.col_query = QueryTool.Create(table_info.col_table.id, {includeCurrentQuery:true});
                that.col_query.notifyQueryUpdated = function() {
                  model_params.set('col_query', that.col_query.get());
                };
                var col_query_tool = that.col_query.createQueryControl({hasSection: true, hasQueryString: true, defaultHidden: true});
                controls_group.addControl(col_query_tool);
                that.row_query = QueryTool.Create(table_info.row_table.id, {includeCurrentQuery:true});
                that.row_query.notifyQueryUpdated = function() {
                  model_params.set('row_query', that.row_query.get());
                  model_params.set('page', 1);
                };
                var row_query_tool = that.row_query.createQueryControl({hasSection: true, hasQueryString: true, defaultHidden: true});
                controls_group.addControl(row_query_tool);


                controls_group.addControl(Controls.Section(view_controls, {
                    title: 'Display settings',
                    bodyStyleClass: 'ControlsSectionBody'
                }));


                //Fix order to by position for col and primary key for row
                that.view = View(view_params.get());

                Msg.listen('',{ type: 'SelectionUpdated'}, function(scope,tableid) {
                    if (tableid == that.model.table.row_table.id) {
                        that._draw();
                    }
                });
                that.model_params = model_params;
                that.view_params = view_params;
            };

            that.draw = function (draw_info) {
                //Save the draw info so that we can redraw when we need to without redrawing the entire panel.
                that.draw_info = draw_info;
                if (!draw_info) return;
                if (draw_info.needZoomIn) {
                  that.download_button.enable(false);
                  return;
                }
                //This is the place where we are called by the framework when the horizontal range is changed so update the model data here.
                var chrom = that.parent_browser.getCurrentChromoID();
                if (!chrom) return;
                var min_genomic_pos = draw_info.offsetX / draw_info.zoomFactX;
                var max_genomic_pos = (draw_info.sizeCenterX + draw_info.offsetX) / draw_info.zoomFactX;

                //Changing the col range will cause a redraw by calling _draw below
                that.model.change_col_range(chrom, min_genomic_pos, max_genomic_pos);

                if (!that.page_controls) {
                    that.page_controls = $('<div class="PnGenotypePageControl" style="position:absolute"> </div>');
                    var page_up = Controls.Button(null,
                        {
                            icon:'fa-chevron-up',
                            vertShift:-2,
                            width:12,
                            height:12,
                            hint:"Page Up",
                            buttonClass:"PnGenotypesPageArrow"
                        })
                        .setOnChanged(function() {
                            that.model_params.set('page', Math.max(that.model_params.get('page')-1, 1));
                        });
                    page_up.modifyEnabled(that.model_params.get('page') > 1);
                    var edit = Controls.Edit(null, {
                        label:'Page:',
                        class: 'PnGenotypesPageEdit',
                        size:2
                    });
                    edit.bindToModel(that.model_params, 'page', function(input) {
                        var num = parseInt(input);
                        if (num != num) //Check for NaN
                            return 1;
                        else
                            return num;
                    });
                    that.page_down = Controls.Button(null,
                        {
                            icon:'fa-chevron-down',
                            width:12,
                            height:12,
                            hint:"Page Down",
                            buttonClass: "PnGenotypesPageArrow"
                        })
                        .setOnChanged(function() {
                            that.model_params.set('page', that.model_params.get('page')+1);
                        });
                    var compound = Controls.Wrapper(Controls.CompoundHor([page_up, Controls.HorizontalSeparator(6), edit, Controls.HorizontalSeparator(6), that.page_down]),"PnGenotypesPageBox");
                    that.page_controls.append(compound.renderHtml());
                    that.getCanvasElementJQ('center').after(that.page_controls);
                    Controls.ExecPostCreateHtml();
                    that.model_params.on({change:'page'}, function() {
                        page_up.modifyEnabled(that.model_params.get('page') > 1);
                    });

                    }
                if (that.page_controls) {
                    that.page_controls.css({
                        top: Math.max(0,draw_info.top_visible + 10),
                        left: (draw_info.sizeCenterX/2) + draw_info.sizeLeftX - 100
                    })
                }

            };

            that._draw = function () {
                var draw_info = that.draw_info;
                if (!draw_info) return;
                if (draw_info.needZoomIn) {
                    that.download_button.enable(false);
                    return;
                }
                //Modify the height of the channel
                var height = 5 + that.view.link_height + that.view.col_header_height;
                if (that.model.row_ordinal.length)
                    height += that.view.row_height * that.model.row_ordinal.length;
                else
                    height += that.view.row_height * that.model_params.get('page_length');
                if (that._height != height) {
                    that.modifyHeight(height);
                    that._myPlotter.resizeHeight(true);
                    //The last call will result in the framework calling draw, so we should end here.
                    return;
                }

                if (that.page_down)
                    that.page_down.modifyEnabled(!(that.model.row_ordinal.length && that.model.row_ordinal.length != that.model_params.get('page_length')));

                that.drawStandardGradientLeft(draw_info, 1);
                that.drawStandardGradientRight(draw_info, 1);

                that.view.draw(draw_info.centerContext,
                               draw_info.leftContext,
                               {t:draw_info.top_visible, b:draw_info.bottom_visible, l:0, r:draw_info.centerContext.canvas.clientWidth},
                               that.model);
                that.drawMark(draw_info);

                that.download_button.enable(that.model.intervals_being_fetched.length == 0);

                that.drawing = false;
            };

            that.download_view = function() {
              var data = '';
              data += '#Dataset: ' + MetaData.database + '\n';
              data += '#Workspace: ' + MetaData.workspaceid + '\n';
              data += '#Table:' + that.table_info.tableCapNamePlural + '\n';
              data += '#'+ that.table_info.col_table.tableCapNamePlural + ' query: ' + that.table_info.col_table.createQueryDisplayString(that.model.col_query) + '\n';
              data += '#'+ that.table_info.row_table.tableCapNamePlural + ' query: ' + that.table_info.row_table.createQueryDisplayString(that.model.row_query) + '\n';
              data += '#Choromosome:' + that.model.chrom + '\n';
              data += '#Start:' + Math.floor(that.model.col_start) + '\n';
              data += '#End:' + Math.ceil(that.model.col_end) + '\n';
              Serialise.createStoredURL(function(url) {
                data += '#URL: '+url+'\n';
                data += 'Position\t';
                for(var i=0; i<that.model.row_primary_key.length; i++)
                  data += that.model.row_primary_key[i] +'\t'
                data += "\n";
                if (that.model.data_type == 'diploid') {
                  for(i=0; i<that.model.col_ordinal.length; i++) {
                    data += that.model.col_ordinal[i] + '\t';
                    for(var j=0; j<that.model.row_ordinal.length; j++) {
                      data += that.model.data[that.model.settings.FirstAllele][j][i];
                      data += ',';
                      data += that.model.data[that.model.settings.SecondAllele][j][i];
                      data += '\t';
                    }
                    data += '\n';
                  }
                } else if (that.model.data_type == 'fractional') {
                  for(i=0; i<that.model.col_ordinal.length; i++) {
                    data += that.model.col_ordinal[i] + '\t';
                    for(var j=0; j<that.model.row_ordinal.length; j++) {
                      data += that.model.data[that.model.settings.Ref][j][i];
                      data += ',';
                      data += that.model.data[that.model.settings.NonRef][j][i];

                      data += '\t';
                    }
                    data += '\n';
                  }
                }


                var blob = new Blob([data], {type: "text/plain;charset=utf-8"});
                FileSaver(blob, MetaData.database + '-' + that.table_info.tableCapNamePlural + '-' + that.model.chrom + '-' + Math.floor(that.model.col_start) + '~' + Math.ceil(that.model.col_end));
              });
            };

            that.handleMouseClicked = function (px, py, area, params) {
                if (area == 'left') {
                    var result = that.view.leftEvent('click', {x:px, y:py}, that.model, params);
                } else if (area == 'center') {
                  var result = that.view.event('click', {x:px, y:py}, that.model, params);
                  if (result.type == 'click_col')
                    Msg.send({ type: 'ItemPopup' }, { tableid:that.table_info.col_table.id, itemid:result.col_key } );
                }
            };

            that.createVisibilityControl = function() {
                var chk=Controls.Check(null,{ label:"Display", value:(true) }).setClassID(that._myID).setOnChanged(function() {
                    that.modifyVisibility(chk.getValue());
                    if (chk.getValue())
                        that.scrollInView();
                });
                return chk;
            };

            that.modifyVisibility = function(isVisible, preventReDraw) {
                that._myPlotter.channelModifyVisibility(that.getID(), isVisible, preventReDraw);
                if (!preventReDraw)
                    that._myPlotter.render();
            };

            that.storeSettings = function() {
                return {
                    rowOrderField: that.model_params.get('row_order')
                };
            };

            that.recallSettings = function(settObj) {
                if (settObj.rowOrderField) {
                    that.model_params.set('row_order',settObj.rowOrderField);
                }
            };

            that.getToolTipInfo = function (px, py) {
                return that.view.getToolTipInfo(px, py, that.model);
            };


            that.getLeftToolTipInfo = function(px, py) {
                return that.view.getLeftToolTipInfo(px, py, that.model);
            };


            that.init(table_info, controls_group, parent);
            return that;
        };
    return GenotypeChannel;
});
