define(["require", "_", "d3", "DQX/Framework", "DQX/ArrayBufferClient", "DQX/Controls", "DQX/Msg", "DQX/Utils",
    "DQX/ChannelPlot/ChannelCanvas", "Utils/QueryTool", "MetaData", "Views/Genotypes/Model",
    "Views/Genotypes/Components/TabContainer", "Views/Genotypes/Components/Container", "Views/Genotypes/ColourAllocator"
    "Views/Genotypes/Components/ColumnHeader", "Views/Genotypes/Components/Genotypes"],
    function (require, _, d3, Framework, ArrayBufferClient, Controls, Msg, DQX, ChannelCanvas, QueryTool, MetaData, Model,
              TabContainer, Container, ColourAllocator, ColumnHeader, Genotypes) {

        var GenotypeChannel = {};

        GenotypeChannel.Channel = function (table_info, controls_group, parent) {
            var id = table_info.id+'_genotypes';
            var that = ChannelCanvas.Base(id);

            that.init = function(table_info, controls_group, parent) {
                that._height = 40;
                that._toolTipHandler = null;
                that._clickHandler = null;
                that.parent_browser = parent;

                //Create controls
                that.col_query = QueryTool.Create(table_info.col_table.id, {includeCurrentQuery:true});
                that.col_query.notifyQueryUpdated = that.new_col_query;
                var col_query_tool = that.col_query.createControl();
                controls_group.addControl(col_query_tool);
                that.row_query = QueryTool.Create(table_info.row_table.id, {includeCurrentQuery:true});
                that.row_query.notifyQueryUpdated = that.new_row_query;
                var row_query_tool = that.row_query.createControl();
                controls_group.addControl(row_query_tool);

                //Fix order to by position for col and primary key for row
                that.model = Model(table_info,
                    that.col_query.get(),
                    that.row_query.get(),
                    table_info.col_table.PositionField,
                    table_info.row_table.primkey,
                    _.map(MetaData.chromosomes, DQX.attr('id'))
                );
                //View parameters
                that.view = {
                    colours: ColourAllocator(),
                    compress: false,
                    row_height: that.row_height,
                    row_header_width: 150
                };
                var col_header = ColumnHeader(that.data, that.view, that.col_header_height, that.clickSNP);
                that.root_container = Container([
                    {name: 'data_area', t:that.gene_map_height, content:
                        TabContainer([
                            {name: 'genotypes', content:
                                Container([
                                    {name:'table', t: that.col_header_height, content:Genotypes(that.data, that.view)},
                                    {name:'column_header', content: col_header}
//                                    {name:'row_header', t: that.col_header_height, content:RowHeader(that.data, that.view)}
                                ])}
//                            {name: 'bifurcation', content:
//                                Container([
//                                    {name:'table', t: that.col_header_height, content:Bifurcation(that.data, that.view)},
//                                    {name:'column_header', content: col_header},
//                                ])},
//                            {name: 'ld', content:
//                                Container([
//                                    {name:'table', t: that.col_header_height, content: LDMap(that.data, that.view)},
//                                    {name:'column_header', content: col_header},
//                                ])},
//                            {name: 'network', content:
//                                Container([
//                                    {name:'network', t: that.col_header_height, content: Network(that.data, that.view)},
//                                    {name:'column_header', content: col_header},
//                                ])},
                        ])}
//                    {name: 'genome', content:GeneMap(that.data, that.view)},
//                    {name: 'controls', content:Controls(that.data, that.view,
//                        {w:that.view.row_header_width, h:that.gene_map_height})
//                    },
                ]);

            };
            
            //Provides a function that will be called when hovering over a position. The return string of this function will be displayed as tooltip
            that.setToolTipHandler = function(handler) {
                that._toolTipHandler = handler
            };

            //Provides a function that will be called when clicking on a position.
            that.setClickHandler = function(handler) {
                that._clickHandler = handler
            };

            that._setPlotter = function(iPlotter) {
                that._myPlotter=iPlotter;
            };

            that.new_col_query = function (q) {
                console.log(q);
            };

            that.new_row_query = function (q) {
                console.log(q);
            };

            that.draw = function (drawInfo, args) {
                var chrom = that.parent_browser.getCurrentChromoID();
                if (!chrom) return;

                var min_genomic_pos = Math.round((-50 + drawInfo.offsetX) / drawInfo.zoomFactX);
                var max_genomic_pos = Math.round((drawInfo.sizeCenterX + 50 + drawInfo.offsetX) / drawInfo.zoomFactX);
                var x_scale = d3.scale.linear().domain([min_genomic_pos, max_genomic_pos]).range([0,1039]);

                var data = that.model.get_range(chrom, min_genomic_pos, max_genomic_pos);
                if (!('pos' in data.col))
                    return;
                var psx = 10, psy = 10;
                var snp_width = 10;
                var pos = data.col['pos'];
                var first_allele = data.twoD['first_allele'];
                var second_allele = data.twoD['second_allele'];
                var depth = data.twoD['total_depth'];
                var row_ID = data.row['ID'];

                if (that._height != 10 * row_ID.length) {
                    that.modifyHeight(10 * row_ID.length);
                    that._myPlotter.handleResize();
                }


//                drawInfo.sizeY = that._height;
                this.drawStandardGradientCenter(drawInfo, 1);
                this.drawStandardGradientLeft(drawInfo, 1);
                this.drawStandardGradientRight(drawInfo, 1);

                var ctx = drawInfo.centerContext;
                for (var row = 0, lr = row_ID.length; row < lr; ++row) {
                    var row_depth = depth[row];
                    var row_first_allele = first_allele[row];
                    var row_second_allele = second_allele[row];
                    for (var col = 0, lc = pos.length; col < lc; ++col) {
                        if (row_first_allele[col] == row_second_allele[col])
                            ctx.fillStyle = 'rgba(0,0,255,'+(row_depth[col]/100)+')';
                        else
                            ctx.fillStyle = 'rgba(255,0,0,'+(row_depth[col]/100)+')';
                        if (row_first_allele[col] == -1 || row_second_allele[col] == -1)
                            ctx.fillStyle = 'rgb(0,0,0)';
                        ctx.fillRect(x_scale(pos[col])-(snp_width*0.01), row*10, Math.ceil(snp_width), 10);
                    }
                }

                this.drawMark(drawInfo);
//                this.drawXScale(drawInfo);
                this.drawTitle(drawInfo);
            };
            
            that.init(table_info, controls_group, parent);
            return that;
        };
    return GenotypeChannel;
});
