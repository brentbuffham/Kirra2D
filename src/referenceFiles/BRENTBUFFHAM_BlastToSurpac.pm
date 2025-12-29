#!/usr/bin/perl
use Lava;
use Macro;
use vulcan;
use List::MoreUtils 'uniq';
use POSIX qw(strftime);
#Show Details of Script
#Lava::Report("Displaying information about Script...");
Lava::Report("#################################################################################");
Lava::Report("#      Title           : BRENTBUFFHAM_BlastToSurpac                              #");
Lava::Report("#      Version         : 1.0                                                    #");
Lava::Report("#      Author          : Brent Buffham                                          #");
Lava::Report("#      Email           : brent.buffham\@gmail.com                                #");
Lava::Report("#                                                                               #");
Lava::Report("#      Description     : Creates STR Blast file for Surpac                      #");
Lava::Report("#                                                                               #");
Lava::Report("#      Primary Use(s)  : Creating Blast Holes as a STR file                     #");
Lava::Report("#      Version 01 Date : 28 APR 2024                                            #");
Lava::Report("#################################################################################");

#Declare Variables
my @xArray;
my @yArray;
my @zArray;
my $polyID;
my $targetRL = 0;
my $segmentNumber;

my $fileHandler;
my $doLevel = 0;
my $doClose = 1;
my $toPoints = 0;
my $toHoles = 0;
my $layerName;
my $objectName;
my $fileName = "blastmaster";
my $filepath = "C:\\Temp\\";

my %userSettings;
my ($sec,$min,$hour,$mday,$mon,$year,$wday,$yday,$isdst) = localtime();


my $datestring = strftime "%d-%b-%y", localtime;

my $loop = 1;
&loadDefaults;

while ($loop == 1){

	#Lava::Report("in while Loop...");

	my $panel = new Lava::Panel;
	
	my $panelTitle1 = "File Setup.";
	my $panelTitle2 = "Set the String/Segment value.";

	$panel->text("Enter the Path Location to save Blast as STR.");
	$panel->item("Path : ", \$filepath, 350);
	$panel->text("                        Note : The Path MUST include a \\ (slash) at the end.");
	$panel->text("Enter the file name.");
	$panel->item("Name : ", \$fileName, 300);
	$panel->text("                        Note : Do not include the file type suffix.");
	$panel->text(" ");
    $panel->numeric("Segment or Sting Number    :",\$segmentNumber,10,0);
	$panel->text(" ");
	$panel->text("Surpac Styles .ssi file properties for Hole Display: {marker,line,#d1*}");
	$panel->text("Use the String Style Code: {512} for blast holes");


	if($panel->execute("$panelTitle1")){
		#Open a file Handler to to start writing a CSV
		my $nameLength = $filepath.length;
		
		if(substr($filepath,($nameLength-1),($filepath.length)) != "\\"){$filepath = "$filepath\\";}
		else{$filepath;}
		open (my $fileHandler, ">$filepath$fileName.str");
		$polyID = 1;

		print $fileHandler ("$fileName,"); 
		print $fileHandler ("$datestring,0.000,0.000\n");
		print $fileHandler ("0, 0.000, 0.000, 0.000,\n");

		#Select the Polygons	
		for(my $polygon = new Lava::Selection("Select the Object to STR","multi,shadow"); $polygon->has_more; $polygon->next)
		{
            if($polygon->is_poly){
                my $points = $polygon->coordinates->n;
                my $objectName = $polygon->name;
                my $objectDesc = $polygon->description;
                my ($x,$y,$z) = $polygon->coordinates->i($i);
                for (my $i = 0; $i < $points; $i++){
                    my ($x,$y,$z) = $polygon->coordinates->i($i);
                    $x = sprintf("%.3f",$x);
                    $y = sprintf("%.3f",$y);
                    $z = sprintf("%.3f",$z);
                    my @printArray;
                    $printArray = "$segmentNumber,$y,$x,$z,$objectName,$objectDesc";
                    Lava::Report("$printArray");
                    print $fileHandler ("$printArray\n");
                }
                # Separate each hole with a 0,0,0,0
                print $fileHandler ("0, 0.000, 0.000, 0.000,\n");

            }

		}
        
		print $fileHandler ("0, 0.000, 0.000, 0.000, END\n");
		close $fileHandler;
		Lava::Message("File Written to : $filepath$fileName.str");
	}
	&saveDefaults;
	$loop = 0;	

}
Lava::Report("Finished Script Run...");

###########################################
# Default Subroutines
############################################

sub loadDefaults
{
	# Load defaults into a hash
	dbmopen %userSettings,"blastFileDefaults",0666;
	#Set the values to the default values
	$filepath	    = $userSettings{'filepath'} || "C:\\Temp\\";
	$fileName	    = $userSettings{'fileName'} || "tempFile";
	$segmentNumber  = $userSettings{'segmentNumber'} || "512";
	dbmclose %userSettings;
}

sub saveDefaults
{
	# Save defaults into a hash
	dbmopen %userSettings,"blastFileDefaults",0666;
	# Save the default values to the below
	$userSettings{'filepath'} 	=$filepath;
	$userSettings{'fileName'} 	=$fileName;
	$userSettings{'segmentNumber'} 	=$segmentNumber;
	dbmclose %userSettings;
}