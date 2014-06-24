# This file is part of Panoptes - (C) Copyright 2014, Paul Vauterin, Ben Jeffery, Alistair Miles <info@cggh.org>
# This program is free software licensed under the GNU Affero General Public License.
# You can find a copy of this license in LICENSE in the top directory of the source code or at <http://opensource.org/licenses/AGPL-3.0>

import os
import config
import DQXDbTools
import authorization
import DQXbase64


def response(returndata):

    credInfo = DQXDbTools.ParseCredentialInfo(returndata)
    sourcetype = DQXDbTools.ToSafeIdentifier(returndata['sourcetype'])
    databaseName = DQXDbTools.ToSafeIdentifier(returndata['database'])
    workspaceid = DQXDbTools.ToSafeIdentifier(returndata['workspaceid'])
    tableid = DQXDbTools.ToSafeIdentifier(returndata['tableid'])
    sourceid = DQXDbTools.ToSafeIdentifier(returndata['sourceid'])

    contentid = returndata['contentid']
    filename = os.path.join(config.BASEDIR, 'temp', 'store_'+contentid)
    with open(filename, 'r') as fp:
        encodedstr = fp.read()
    os.remove(filename)
    content = DQXbase64.b64decode_var2(encodedstr)

    baseFolder = config.SOURCEDATADIR + '/datasets'
    settingsFile = None
    if sourcetype == 'dataset':
        settingsFile = os.path.join(baseFolder, databaseName, 'settings')
        authorization.VerifyIsDataSetManager(credInfo, databaseName)
    if sourcetype == 'datatable':
        settingsFile = os.path.join(baseFolder, databaseName, 'datatables', tableid, 'settings')
        authorization.VerifyIsDataSetManager(credInfo, databaseName)
    if sourcetype == 'workspace':
        settingsFile = os.path.join(baseFolder, databaseName, 'workspaces', workspaceid, 'settings')
        credInfo.VerifyCanDo(DQXDbTools.DbOperationWrite(databaseName, 'workspaces'))
    if sourcetype == 'customdata':
        settingsFile = os.path.join(baseFolder, databaseName, 'workspaces', workspaceid, 'customdata', tableid, sourceid, 'settings')
        credInfo.VerifyCanDo(DQXDbTools.DbOperationWrite(databaseName, 'workspaces'))
    if settingsFile is None:
        returndata['Error'] = 'Invalid file source type'
        return returndata

    try:
        with open(settingsFile, 'w') as fp:
            fp.write(content)

    except Exception as e:
        returndata['Error'] = str(e)

    return returndata