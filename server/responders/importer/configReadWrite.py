import os
import uuid
from os import path, listdir
from os.path import join

from os.path import exists
from responders.importer import ImpUtils
from simplejson import load, loads, dumps
from PanoptesConfig import PanoptesConfig
from SettingsDataset import SettingsDataset
from SettingsDataTable import SettingsDataTable
from Settings2Dtable import Settings2Dtable
from SettingsRefGenome import SettingsRefGenome
from SettingsMapLayer import SettingsMapLayer
from readChromLengths import readChromLengths

pnConfig = PanoptesConfig(None)
sourceDir = join(pnConfig.getSourceDataDir(), 'datasets')
baseDir = pnConfig.getBaseDir()

def readSetOfSettings(dirPath, loader, wanted_names=None):
    if not path.isdir(dirPath):
        return {}
    result = {}
    for name in listdir(dirPath):
        if path.isdir(join(dirPath, name)) and (not wanted_names or name in wanted_names):
            settings_file = join(dirPath, name, 'settings')
            result[name] = loads(loader(settings_file, validate=True).serialize())
            with open(settings_file, 'r') as yaml:
                result[name]['_yaml'] = yaml.read()
    return result

def readJSONConfig(datasetId):
    dataset_folder = join(sourceDir, datasetId)
    base_folder = join(baseDir, 'config', datasetId)
    if not path.isdir(dataset_folder):
        raise Exception('Error: ' + datasetId + ' is not a known dataset in the source directory')
    settings_file = join(dataset_folder, 'settings')
    settings = loads(SettingsDataset(settings_file, validate=True).serialize())
    with open(settings_file, 'r') as yaml:
        settings['_yaml'] = yaml.read()

    chromosomes = None
    try:
        with open(join(base_folder, 'chromosomes.json'), 'r') as f:
            chromosomes = load(f)
    except IOError:
        print('Cached chrom config not found - scanning')
        try:
            chromosomes = readChromLengths(join(dataset_folder, 'refgenome', 'refsequence.fa'))
        except IOError:
            print('refsequence.fa not found - skipping')

    tables = readSetOfSettings(join(dataset_folder, 'datatables'), SettingsDataTable, settings.get('DataTables'))
    try:
        for tableId, table_config in tables.items():
            config_file = join(base_folder, tableId, 'dataConfig.json')
            if exists(config_file):
                with open(config_file, 'r') as f:
                    data_config = load(f)
                    for prop in table_config['properties']:
                        if prop['id'] in data_config:
                            for key, value in data_config[prop['id']].items():
                                if key not in prop:
                                    prop[key] = value

    except IOError:
        print('Cached data derived config not found - skipping')
    for tableId, table_config in tables.items():
        graph_file = join(base_folder, tableId, 'graphConfig.json')
        if exists(graph_file):
            with open(graph_file, 'r') as f:
                tables[tableId]['trees'] = load(f)

    twoDTables = readSetOfSettings(join(dataset_folder, '2D_datatables'), Settings2Dtable, settings.get('2D_DataTables'))
    genome_settings_file = join(dataset_folder, 'refgenome', 'settings')
    genome = None
    try:
        genome = loads(SettingsRefGenome(genome_settings_file, validate=True).serialize())
    except IOError:
        print('refgenome settings not found - skipping')
    if genome is not None:
        with open(genome_settings_file, 'r') as yaml:
            genome['_yaml'] = yaml.read()
    mapLayers = readSetOfSettings(join(dataset_folder, 'maps'), SettingsMapLayer)
    #As an optimisation we send index.html if it exists to avoid the inevitable request.
    try:
        with open(join(baseDir, 'Docs', datasetId, 'index.html'), 'r') as f:
            introPage = f.read()
    except IOError:
        introPage = None

    return {
        'cas': {'service': pnConfig.getCasService(), 'logout': pnConfig.getCasLogout()},
        'settings': settings,
        'chromosomes': chromosomes,
        'tablesById': tables,
        'twoDTablesById': twoDTables,
        'genome': genome,
        'mapLayers': mapLayers,
        'docs': {'index.html': introPage}
    }

class ReadOnlyErrorWriter:
    def __init__(self, name):
        self.name = name
    def updateAndWriteBack(self, action, updatePath, newConfig, validate=True):
        raise Exception("The config at:"+'.'.join([self.name]+updatePath)+" is read-only")

class DocsWriter:
    def __init__(self, datasetId):
        self.datasetId = datasetId
    def updateAndWriteBack(self, action, path, content, validate=True):
        path = '.'.join(path)
        if action is not 'replace':
            Exception("Method:" + action + " is not implemented for docs")
        filename = join(baseDir, 'Docs', self.datasetId, path)
        tempFileName = filename + '_tmp' + str(uuid.uuid4())
        with open(tempFileName, 'w') as tempfile:
            tempfile.write(content)
            tempfile.flush()
            os.fsync(tempfile.fileno())
            os.rename(tempFileName, filename)
        return {path: content}


def writeJSONConfig(datasetId, action, path, newConfig):
    dataset_folder = join(sourceDir, datasetId)
    #We have a path in the combined JSON object - we now follow the path until we hit a subset confined to one YAML handler
    writers = {
        'settings': lambda path: (path, SettingsDataset(join(dataset_folder, 'settings'), validate=True)),
        'chromosomes': lambda path: (path, ReadOnlyErrorWriter('chromosomes')),
        'tablesById': lambda path: (path[1:],
                                    SettingsDataTable(join(dataset_folder, 'datatables', path[0], 'settings'), validate=True)),
        'twoDTablesById': lambda path: (path[1:],
                                        SettingsDataTable(join(dataset_folder, '2D_datatables', path[0], 'settings'), validate=True)),
        'genome': lambda path: (path, ReadOnlyErrorWriter('genome')), #For now as this will likely get a refactor
        'mapLayers': lambda path: (path, ReadOnlyErrorWriter('mapLayers')),  # For now as this will likely get a refactor
        'docs': lambda path: (path, DocsWriter(datasetId))
    }
    path = path.split('.')
    (path, writer) = writers[path[0]](path[1:])
    return writer.updateAndWriteBack(action, path, newConfig, validate=True)

def writeYAMLConfig(datasetId, path, newConfig):
    dataset_folder = join(sourceDir, datasetId)
    temp_settings_filename = ImpUtils.GetTempFileName()
    with open(temp_settings_filename, 'w') as temp_settings_file:
        temp_settings_file.write(newConfig)
    validators = {
        'settings': lambda path: (join(dataset_folder, 'settings'),
                                  SettingsDataset(temp_settings_filename, validate=True)),
        'genome': lambda path: (join(dataset_folder, 'refgenome', 'settings'),
                                  SettingsRefGenome(temp_settings_filename, validate=True)),
        'tablesById': lambda path: (join(dataset_folder, 'datatables', path[0], 'settings'),
                                    SettingsDataTable(temp_settings_filename, validate=True)),
        'twoDTablesById': lambda path: (join(dataset_folder, '2D_datatables', path[0], 'settings'),
                                        SettingsDataTable(temp_settings_filename, validate=True)),
    }
    path = path.split('.')
    try:
        (settings_file, validator) = validators[path[0]](path[1:])
        #Validation happens in the validator constructor that is called in the lambda
        #So if we get here without exception thrown by validation then we can copy the new settings onto the old
        os.system('mv %s %s' % (temp_settings_filename, settings_file))
    finally:
        try:
            os.remove(temp_settings_filename)
        except OSError:
            pass

