# This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import os
import DQXDbTools
import DQXUtils
import config
from DQXTableUtils import VTTable
import SettingsLoader
import ImpUtils
import shutil
import customresponders.panoptesserver.Utils as Utils
from DQXDbTools import DBCOLESC
from DQXDbTools import DBTBESC
from DQXDbTools import DBDBESC


def ImportRefGenomeSummaryData(calculationObject, datasetId, folder, importSettings):
    if not os.path.exists(os.path.join(folder, 'summaryvalues')):
        return

    calculationObject.credentialInfo.VerifyCanDo(DQXDbTools.DbOperationWrite(datasetId, 'summaryvalues'))

    summaryids = []
    for dir in os.listdir(os.path.join(folder, 'summaryvalues')):
        if os.path.isdir(os.path.join(folder, 'summaryvalues', dir)):
            summaryids.append(dir)
    for summaryid in summaryids:
        with calculationObject.LogHeader('Importing reference genome summary data '+summaryid):
            DQXUtils.CheckValidColumnIdentifier(summaryid)
            destFolder = os.path.join(config.BASEDIR, 'SummaryTracks', datasetId, summaryid)
            if not os.path.exists(destFolder):
                os.makedirs(destFolder)
            dataFileName = os.path.join(destFolder, summaryid)
            shutil.copyfile(os.path.join(folder, 'summaryvalues', summaryid, 'values'), dataFileName)

            settings = SettingsLoader.SettingsLoader(os.path.join(folder, 'summaryvalues', summaryid, 'settings'))
            settings.RequireTokens(['Name', 'MaxVal', 'MaxVal', 'BlockSizeMax'])
            settings.AddTokenIfMissing('MinVal', 0)
            settings.AddTokenIfMissing('BlockSizeMin', 1)
            settings.AddTokenIfMissing('ChannelColor', 'rgb(0,0,0)')
            settings.AddTokenIfMissing('Order', 99999)
            settings.DefineKnownTokens(['channelColor'])
            settings.AddTokenIfMissing('ScopeStr', importSettings['ScopeStr'])
            print('SETTINGS: '+settings.ToJSON())
            if importSettings['ScopeStr'] == 'all':
                print('Executing filter bank')
                ImpUtils.ExecuteFilterbankSummary_Value(calculationObject, destFolder, summaryid, settings)
            else:
                calculationObject.Log('WARNING: Skipping filterbanking genome summary data')
            extraSettings = settings.Clone()
            extraSettings.DropTokens(['Name', 'Order', 'MinVal', 'MaxVal', 'BlockSizeMin', 'BlockSizeMax'])
            sql = "INSERT INTO summaryvalues VALUES ('', 'fixed', '{0}', '-', '{1}', {2}, '{3}', {4}, {5}, {6})".format(
                summaryid,
                settings['Name'],
                settings['Order'],
                extraSettings.ToJSON(),
                settings['MinVal'],
                settings['MaxVal'],
                settings['BlockSizeMin']
            )
            ImpUtils.ExecuteSQL(calculationObject, datasetId, sql)



def ImportRefGenome(calculationObject, datasetId, folder, importSettings):
    with calculationObject.LogHeader('Importing reference genome data'):

        ImportRefGenomeSummaryData(calculationObject, datasetId, folder, importSettings)

        settings = SettingsLoader.SettingsLoader(os.path.join(folder, 'settings'))
        settings.DefineKnownTokens(['AnnotMaxViewportSize', 'RefSequenceSumm'])
        print('Settings: '+str(settings.Get()))
        ImpUtils.ImportGlobalSettings(calculationObject, datasetId, settings)

        # Import reference genome
        if importSettings['ScopeStr'] == 'all':
            refsequencefile = os.path.join(folder, 'refsequence.fa')
            if os.path.exists(refsequencefile):
                with calculationObject.LogHeader('Converting reference genome'):
                    destfolder = config.BASEDIR + '/SummaryTracks/' + datasetId + '/Sequence'
                    if not os.path.exists(destfolder):
                        os.makedirs(destfolder)
                    tempfastafile = destfolder + '/refsequence.fa'
                    shutil.copyfile(refsequencefile, tempfastafile)
                    ImpUtils.RunConvertor(calculationObject, 'Fasta2FilterBankData', destfolder, ['refsequence.fa'])
            else:
                calculationObject.Log('WARNING: missing reference sequence file')
        else:
            calculationObject.Log('WARNING: Skipping converting reference genome')


        # Import chromosomes
        with calculationObject.LogHeader('Loading chromosomes'):
            tb = VTTable.VTTable()
            tb.allColumnsText = True
            try:
                tb.LoadFile(os.path.join(folder, 'chromosomes'))
            except Exception as e:
                raise Exception('Error while reading chromosomes file: '+str(e))
            tb.RequireColumnSet(['chrom', 'length'])
            tb.RenameCol('chrom','id')
            tb.RenameCol('length','len')
            tb.ConvertColToValue('len')
            with calculationObject.LogDataDump():
                tb.PrintRows(0, 99)
            sqlfile = ImpUtils.GetTempFileName()
            tb.SaveSQLDump(sqlfile, 'chromosomes')
            ImpUtils.ExecuteSQL(calculationObject, datasetId, 'DELETE FROM chromosomes')
            ImpUtils.ExecuteSQLScript(calculationObject, sqlfile, datasetId)
            os.remove(sqlfile)

        if importSettings['ScopeStr'] == 'all':
            # Import annotation
            with calculationObject.LogHeader('Converting annotation'):
                tempgfffile = ImpUtils.GetTempFileName()
                temppath = os.path.dirname(tempgfffile)
                shutil.copyfile(os.path.join(folder, 'annotation.gff'), tempgfffile)
                ImpUtils.RunConvertor(calculationObject, 'ParseGFF', temppath, [os.path.basename(tempgfffile)])
                print('Importing annotation')
                ImpUtils.ExecuteSQLScript(calculationObject, os.path.join(temppath, 'annotation_dump.sql'), datasetId)
                os.remove(tempgfffile)
                os.remove(os.path.join(temppath, 'annotation.txt'))
                os.remove(os.path.join(temppath, 'annotation_dump.sql'))
                os.remove(os.path.join(temppath, 'annotation_create.sql'))
        else:
            calculationObject.Log('WARNING: Skipping converting annotation')

