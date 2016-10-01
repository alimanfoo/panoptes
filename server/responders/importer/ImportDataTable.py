# This file is part of Panoptes - (C) Copyright 2014, CGGH <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import os
import shutil
from ProcessDatabase import ProcessDatabase
from BaseImport import BaseImport
from SettingsGraph import SettingsGraph

class ImportDataTable(BaseImport):

    #Retrieve and validate settings
    def getSettings(self, tableid):
        tableSettings = self._fetchSettings(tableid)    
        
        if tableSettings['maxTableSize'] is not None:
            self._log('WARNING: table size limited to '+str(tableSettings['maxTableSize']))
                   
        return tableSettings

    def ImportDataTable(self, tableid):
        
        with self._logHeader('Importing datatable {0}'.format(tableid)):
   
            tableSettings = self.getSettings(tableid)

            importer = ProcessDatabase(self._calculationObject, self._datasetId, self._importSettings)
                       
            importer.importData(tableid, createSubsets = True)
            
            importer.cleanUp()

            #Disabled till implemented in monet
            # filterBanker.createTableBasedSummaryValues(tableid)
                
            self.importGraphs(tableid)


    def importGraphs(self, tableid):
        folder = self._datatablesFolder
        with self._logHeader('Importing graphs'):
            self._dao.deleteGraphsForTable(tableid)
            graphsfolder = os.path.join(folder, tableid, 'graphs')
            if os.path.exists(graphsfolder):
                for graphid in os.listdir(graphsfolder):
                    if os.path.isdir(os.path.join(graphsfolder, graphid)):
                        print('Importing graph ' + graphid)
                        graphfolder = os.path.join(graphsfolder, graphid)
                        
                        graphSettings = SettingsGraph(os.path.join(graphfolder, 'settings'))
                       
                        self._dao.insertGraphForTable(tableid, graphid, graphSettings)
                        destFolder = os.path.join(self._config.getBaseDir(), 'Graphs', self._datasetId, tableid)
                        if not os.path.exists(destFolder):
                            os.makedirs(destFolder)
                        shutil.copyfile(os.path.join(graphfolder, 'data'), os.path.join(destFolder, graphid))

    
    def importAllDataTables(self):
        
        datatables = self._getTables()
        
        datatables = self._getDatasetFolders(datatables)

        for datatable in datatables:
            
            self.ImportDataTable(datatable)
        
        return datatable
    
    