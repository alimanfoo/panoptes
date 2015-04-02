Installation and deployment guide
=================================

.. note::
  Successfully deploying and administering Panoptes requires familiarity with the following technologies:
  - MySQL
  - Python
  - WSGI
  - Web servers (e.g. Apache2)
  - Unix system administration


Automatic deployment on a new Ubuntu EC2 image
----------------------------------------------

For testing purposes, the simplest way to obtain a running instance of Panoptes is to do a full deployment on a fresh a fresh Ubuntu 14.04.1 LTS image,
e.g. on an EC2 virtual machine.
A script is provided that performs a fully automatic installation, including

- Installation of all dependencies
- Deployment and configuration of MySQL
- Deployment and configuration of Apache2

.. caution::
  This deployment option will aggressively override packages and settings on the machine. It is only intended to be used on a fresh image.

The following steps will create a fully working Panoptes instance on a Amazon EC2 Ubuntu 14.04.1 LTS image::

  cd /
  sudo wget https://raw.github.com/cggh/panoptes/master/scripts/deploy_default/deployfull.sh
  sudo chmod +x deployfull.sh
  sudo ./deployfull.sh

The source data folder is set to `/panoptes/sourcedata`. The application is accessible from `[ServerName]/index.html`.

Manual installation
-------------------

Download & dependencies
.......................
Download the code from the GitHub repository::

    wget https://github.com/cggh/panoptes/archive/master.zip
    unzip master.zip
    cd panoptes-master

Panoptes needs a running MySQL version **5.6 or later** with permission to create and remove databases. The MySQL client tools also have to be installed on the machine running Panoptes. Install MySQL if you don't have it E.g. for debian-based Linuxes::

    sudo apt-get install mysql-server-5.6 mysql-client-5.6

.. caution::
  Note that if there are tables from other apps that name-collide with Panoptes dataset names then there will be data loss.
  **Use a separate MySQL install or set your MySQL permissions carefully!**

You will need to install the following packages (or equivalent) before Panoptes can be installed. E.g. for debian-based Linuxes::

	sudo apt-get install git gcc gfortran python-dev python-virtualenv libblas-dev liblapack-dev cython libmysqlclient-dev

You will also need libhdf5-dev. This is a virtual package satisfied by the several different install types of HDF5. The simplest solution is to::

    sudo apt-get install libhdf5-serial-dev

unless you want a specific HDF5 setup.

Build
.....
In the directory where the code was unzipped, copy 'config.py.example' to 'config.py'.
Edit the file and specify the following components:

- MySQL setup (DBSRV, DBUSER, DBPASS).

.. note::
  The login credentials used need to have sufficient privileges to perform alterations such as database creation.

- A directory Panoptes can use for storing files (BASEDIR, see further).
- A directory that will contain the source data files (SOURCEDATADIR, see further)

.. note::
  Changes in 'config.py' are used on build, so you will need to rebuild if they change.

To build run::

	./scripts/build.sh

to create a panoptes installation in 'build'. Note that this deletes any existing build.
This build copies the different components of the application, and merges them into a single file structure.
Note that, during this process, a copy of `config.py` is put in the build folder. This copy is used by the actual server process.
This will attempt to install the needed python packages and link Panoptes into the DQXServer framework which serves the app.

.. _server-data-structure:

Server data file structure
..........................
Panoptes uses two file directories, and the location of both has to be specified in config.py
(example: `config.py.sample <https://github.com/cggh/DQXServer/blob/master/config.py.sample#L38>`_).

BASEDIR:
This is the root directory for storing file-based server data. It should contain subdirectories "SummaryTracks", "Uploads" and "temp".
All should have write privileges for the user that runs the server.

SOURCEDATADIR:
This directory contains the file-bases data sources that are used to import into the Panoptes datasets.

.. note::
  Both paths have to be specified as absolute, starting from /. Do not use relative paths here.

See section :doc:`importdata/_intro` for more information on how to populate the Panoptes instance with data.

Simple Server
.............
The simplest way to run Panoptes is using::

	./scripts/run.sh

by default, this serves Panoptes on http://localhost:8000/index.html using gunicorn.
To run on your external network interface use (with the port you desire)::

	./scripts/run.sh 0.0.0.0:8000

Note that you will need internet access even if you run Panoptes locally due to google-hosted mapping tools.

Deployment on Apache2
.....................

.. note::
  This section describes a deployment strategy where the static files (html, css, js)
  are also served through the WSGI interface. This allows one to protect the application using a CAS Single Sign-On service.
  
Install the Apache2 wsgi dependency `libapache2-mod-wsgi`.

Create a symbolic link in `/var/www/` to `[PanoptesInstallationPath]/build/DQXServer/wsgi_server.py`::

    ln -s [PanoptesInstallationPath]/build/DQXServer/wsgi_server.py /var/www/.

The build script uses a virtualenv for the installation of Python dependencies,
and the Apache2 WSGI configuration has to be instructed to use that virtualenv.
An example VirtualHost config would be (note that the tokens need to be replaced by their proper values)::

    <VirtualHost *:80>
        DocumentRoot /var/www
        <Directory />
            Options FollowSymLinks
            AllowOverride None
        </Directory>
        WSGIDaemonProcess Panoptes processes=2 threads=25 python-path=[PanoptesInstallationPath]/build/panoptes_virtualenv/lib/python2.7/site-packages:[PanoptesInstallationPath]/build/DQXServer
        WSGIProcessGroup Panoptes
        WSGIScriptAlias / /var/www/wsgi_server.py
    </VirtualHost>

In this configuration, the app is served from::

  [ServerName]:80/



.. _authorization:

Authorization
-------------
Panoptes contains a simple authorization mechanism that can be used to grant or deny certain privileges on datasets.
There are three levels of privileges:

 - Read: View the data in a dataset.
 - Edit: Add custom data properties to a workspace.
 - Manage: All actions, including loading the dataset from the file source.
 
The authorization mechanism interacts with authentication systems implemented at the web server level,
by reading the REMOTE_USER environment variable.

Specifically, Panoptes can integrate with a CAS Single Sign-On service. To enable this, specify the CAS service
url in the `CAS_SERVICE` variable in `config.py`. In this case, authentication can also be based on user groups.

The file PanoptesAuthDb (https://raw2.github.com/cggh/panoptes/master/servermodule/panoptesserver/PanoptesAuthDb)
is used to link user authentication information to privileges on specific datasets.
The default installation grants all rights to everybody.
