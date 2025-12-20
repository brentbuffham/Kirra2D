#!/usr/bin/perl
use Lava;
use Macro;
use vulcan;
use List::MoreUtils 'uniq';
#Show Details of Script
#Lava::Report("Displaying information about Script...");
Lava::Report("#################################################################################");
Lava::Report("#      Title           : BRENTBUFFHAM_SurfaceMan_Files-GF-H-S                   #");
Lava::Report("#      Version         : 1.0                                                    #");
Lava::Report("#      Author          : Brent Buffham                                          #");
Lava::Report("#      Email           : brent.buffham\@gmail.com                               #");
Lava::Report("#                                                                               #");
Lava::Report("#      Description     : Creates a Geofence or Hazard or Sockets File.          #");
Lava::Report("#                                                                               #");
Lava::Report("#      Primary Use(s)  : Creating additional Geofences                          #");
Lava::Report("#      Version 01 Date : 12 - JUN - 2024                                        #");
Lava::Report("#################################################################################");

#Declare Variables
my @xArray;
my @yArray;
my $xLast;
my $yLast;

my $fileHandler;

my $layerName;
my $objectName;
my $geofenceName = "Geofence";
my $geofencePath = "C:\\Temp\\";
my @fileTypes = ("geofence","hazard","socket");
my %userSettings;

my $loop = 1;
&loadDefaults;

while ($loop == 1){

	#Lava::Report("in while Loop...");

	my $panel = new Lava::Panel;
	
	my $panelTitle1 = "Geofence Path.";
	my $panelTitle2 = "Select the Polygon to make a Geofence.";

	$panel->text("Enter the Path Location to save the file.");
	$panel->item("Path : ", \$geofencePath, 300);
	$panel->text("						Note : include a \\ at the end of the path name.");
	$panel->text(" ");
	$panel->text("Select the type of file to create.");
	$panel->item("File Type: ", \$fileType);
	$panel->pick_list_data(@fileTypes);  # Add pick list data after item
	$panel->text("Enter the Name of the file.");
	$panel->item("Name : ", \$geofenceName, 300);
	$panel->text("                        Note : Do not include the file type suffix.");

	if($panel->execute("$panelTitle1")){
		for(my $polygon = new Lava::Selection("$panelTitle2","single,shadow"); 
		$polygon->has_more; 
		$polygon->next){
		
			my $points = $polygon->coordinates->n;
			
			if($points >= 150 && ($fileType eq "geofence" || $fileType eq "hazard")){
				Lava::Error("ENDING SCRIPT - There are 150 or more points - ENDING SCRIPT");
			}
			else{
				my @array;
				for(my $k = 0; $k <$points; $k++){
					my ($xCheck,$yCheck) = $polygon->coordinates->i($k);
					$yCheck = sprintf("%.3f",$yCheck);
					$xCheck = sprintf("%.3f",$xCheck);
					$array[$k] = "$yCheck,$xCheck";
				}
				my @uniqueArray = uniq @array;
				if (scalar(@array) == scalar(@uniqueArray)){
					Lava::Report("No Duplicate Points Found...");
				}
				else{
					Lava::Error("ENDING SCRIPT - Duplicate Points Found - ENDING SCRIPT.");
					die;
				}
						
				my $nameLength = $geofencePath.length;
				if(substr($geofencePath,($nameLength-1),($geofencePath.length)) != "\\"){
					$geofencePath = "$geofencePath\\";
				}
				else{
					$geofencePath;
				}
			
				my $fileHandler;

				if ($fileType eq "geofence") {
					open ($fileHandler, ">$geofencePath$geofenceName.geofence");
				}
				elsif ($fileType eq "hazard") {
					open ($fileHandler, ">$geofencePath$geofenceName.hazard");
				}
				elsif ($fileType eq "socket") {
					open ($fileHandler, ">$geofencePath$geofenceName.socket");
				}
				else{
					Lava::Error("ENDING SCRIPT - File Type not selected - ENDING SCRIPT");
					die;
				}
			
				for(my $i = 0; $i <$points; $i++){
					my ($x,$y,$z,$con,$name) = $polygon->coordinates->i($i);
					$xArray[$i] = sprintf("%.3f",$x);
					$yArray[$i] = sprintf("%.3f",$y);
					my @printArray;
					$printArray[$i] = "$yArray[$i],$xArray[$i]";
					if($i<1){
						Lava::Report("Geofence files consist of Y,X coordinates...");
						Lava::Report("Y,X");
					}
					Lava::Report("$yArray[$i],$xArray[$i]");
					#print $fileHandler ("$yArray[$i],$xArray[$i]\r\n");
					print $fileHandler ("$printArray[$i]\n");
					
					if ($i==$points-1){
						$xLast = sprintf("%.0f",$xArray[0]);
						$yLast = sprintf("%.0f",$yArray[0]);
						$xLast = sprintf("%.3f",$xLast);
						$yLast = sprintf("%.3f",$yLast);
						Lava::Report("$yLast,$xLast");
						push(@printArray, "$yLast,$xLast");
						print $fileHandler ($printArray[$i+1]);
					}
					
				}

				close $fileHandler;
				Lava::Message("File Written to : $geofencePath$geofenceName.geofence");
			}
		}
	}
	
			
	&saveDefaults;
	$loop = 0;

}
#Lava::Report("Finished Script Run...");

###########################################
# Default Subroutines
############################################

sub loadDefaults
{
	# Load defaults into a hash
	dbmopen %userSettings,"SM-FileDefaults",0666;
	#Set the values to the default values
	$geofencePath	= $userSettings{'geofencePath'} || "C:\\Temp\\";
	$geofenceName	= $userSettings{'geofenceName'} || "GeofenceTempFile";
	$fileType		= $userSettings{'fileType'} || "geofence";
	dbmclose %userSettings;
}

sub saveDefaults
{
	# Save defaults into a hash
	dbmopen %userSettings,"SM-FileDefaults",0666;
	# Save the default values to the below
	$userSettings{'geofencePath'} 	=$geofencePath;
	$userSettings{'geofenceName'} 	=$geofenceName;
	$userSettings{'fileType'} 		=$fileType;
	dbmclose %userSettings;
}