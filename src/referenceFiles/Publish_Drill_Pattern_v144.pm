#############################################################
# Publish_Drill_Pattern_v100.lava
#
# VULCAN Lava (Perl) script. Exports D&B holes to formatted and flagged interface csv file.
#
# Author:  Matthew Seeber 
#
# Matthew Seeber
# Value Solutions Pty Ltd
# seeb@iinet.net.au
# 0408952817            
#
#  20130531	Matthew Seeber 	Initial prototype version
#  20130725		"			Using DBS report from .dab file
#  20130801		"			Allow blast polygon ot be in different layer
#  20130805		"			Use breserve_v2 and put bcm, tonnes, bmf,solid in header
#  20130816		"			Read HOLE TYPE from Feature
#  				"			put HOLE TYPE last column
#  26082013		"			Added path for hardness file
#  27082013		"			Fixed DEPTH 
#  06092013		"			Dont export ‘HOLE TYPE’, ‘STRATNUM’ AND ‘BLAST NAME’ 
#  				"			Remove date from file name, remove blank line in header
#  13092013		"			Leading zeros on blast number, option for 3 or 4 digits. 
#               "           3DPs in Diameter
#               "           Option to include pushback in name
#  20130913	John Racovelli	1 DP for hole depths	
#  20131016	Matthew Seeber	Put stratnum back in output file 
#  20131111		"			Added output to FMS	
#  20131114		"			Check MQ2 PIT_ID is valid
#  20131115		"			Add BH output	and rename script to Publish_Drill_Pattern_v100.lava
#  20131118		"			Default hardness and sg
#  20131119		"			Leading zeros for design bench as well
#				"			Fix pick lists for tripath and stratpath
#  20131121		"			Avoid dependency on MQ2PROD DSN
#  20131128		"			Change MQ2 message to Show so it does not require click
#				"			Allow multiple blasts in LAYER with comment as 4th token
#				"			Allow underscore _ in Blast name
#  20131129		"			Allow invalid pattern from Description
#  20131211		"			Optional build blast solid
#  20131217		" 			Make Default SG mandatory
#  20131219		"			Put Pattern back into DBS file
#  20131224		"			Fix solid name for auto generate option
#							Remove option to input solid name
#							Default to B&B volume if block model does not work
#  20131231		"			Default tonnage using default SG
#  20140121		"			Add $mq2_mine_site for fms, change file to csv and change column 1 to pattern
#  20140131		"			Allow 2 DPs for Span limit factor, remove hard coded 3 in panel
#  20140212		"			Turn back on user supplied solid 
#  20140217		"			For now output both fms formats
#  20140227		"			v115 restrict default hardness to 1,2,3
# v116 20140321	"			Add survey output SETOUT
# v117 20140325	"			Add Blasttype to header, Use block model for volume without flagging
# v118 20140403 "			Add BCM_FROM and check for previous list items exist for bmf and solid.
# v119 20140410	"			Add Version number to panel
#							For JMB use last 2 characters of pit for column 1 in FMS file
#							Turn off solid checkings for volume.
# v120 20140411	"			JMB FMS format different to other sites.
# v121 20140424	"			Default Instruction to previous to make setting on multiple easy.	
# v122_ABDT_Trial 20140818	Trial version for ADBT autonomous drill rig based upon Publish_Drill_Pattern_v121.lava
# v123_ABDT_Trial 20140828	Check number of points in geo fence
#							Change ABDT to Surface Manager
# v124 20140902	"			Flag to turn off ABDT trial options
#							Use hardnum as default if in block model
# v125 20141120 "			Changed fence file name from <filename>.csv to <filename>.geofence
# v126 20141202	"			Filter fence for duplicate points on export
# v127 20150114	"			Allow for STGM hardness variable to be called hardness or hardnum
# v128 20150119 "			and now just hard as well!
#                           Add fence close points check
# v129 20150223	"			Allow for multiple geo fences
#							Option to turn on Surface Manager options on main panel
#							hard code to Jimblebar FMS format
# v130 20150518	"			Add trimble output
# v131 20150530 "			Added ignore subdrill for DBS report spec and OPENPIT_NBLAST_CREATE_SOLID	
# v132 20150530	"			Unlock block model if bmask fails and allow user to change default SG based upon bmf sg inside solid
# v133 20150603 "			Put header in map file for bmask to work in Vulcan 9.1.1
# v134 20150701	"			Disable Blastholes output
# v135 20150723 "			Re-enable Blastholes output for Final survey only
# v136 20150811 "			Add header to geofence text file and output trimble as dxf
# v137 20160602 "			Increase fence points to 500
# v138 20180525 "           Add output for Blastlogic and include PATTERN_GUID and PATTERN_VER
# v139 20180529 "           Use myRunCommand, all BH for DESIGN
#                           Temporarily use a CSV file as the audit registry of assigned GUIDs
#                           until they can be checked within Blastholes or other database.
#                           Index by $mq2_mine_site. Configured for JB only.
# v140 20180606 "           Fix bug with closing bmm file
# v141 20180618 "			Use BH_PATTERN_GUIDS table from Blastholes
#							Build lists of MQ2 pits and mine sites in Loaddefaults 
#							Restructure code so that pit is knows before ggetting GUID
# v142 20180626				Fix label on guid versions panel and always use registry if specified
# v143 20180627				Only select GUIDs for P.PATTERN_OR_FLITCH = 'P'
# v144 20181003             Remove - xxx from Secondary blast types
#                           Comment out GUID registry options
#
# tab 4
############################################################
#
use Cwd;
use Win32;
use Win32::OLE;
use Lava;
use Macro;
use vulcan;
use Tie::File;
use List::Util qw( min max );

no if ($] >= 5.018), 'warnings' => 'experimental';

#GLOBAL VARIABLES

my $Version = "144"; 
my $prog = "Publish_Drill_Pattern_v${Version}.lava";

$enablebhout = 1;

my $maxfencepoints = 500;
$dSmall = 0.00001; 
$debug = 0;
$bmaskfailed = 0;

# --------------------------------------
# database connection strings for Oracle 
# --------------------------------------
my $ConnStrBH  = "Provider=OraOLEDB.Oracle;Data Source=BHPRODAPP;User ID=BHREADONLY;Password=BHREADONLY";
#my $ConnStrBH  = "Provider=OraOLEDB.Oracle;Data Source=BHTEST;User ID=BHREADONLY;Password=BHREADONLY";
my $ConnStrMQ2 = "Provider=OraOLEDB.Oracle;Data Source=MQ2PROD;User ID=MQ2VIEW;Password=MQ2VIEW";

# Temporarily use a CSV file as the audit registry of assigned GUIDs
# until they can be checked within Blastholes or other database.
#
#PATTERN,PATTERN_GUID,PATTERN_VER,USERNAME,DATETIME
#18EP-0528-1780,EFDBAE3D-0A58-4C3F-8006-5DA813FF678D,1,SEEBM9,30/05/2018 7:41
#
my $defpatternguidregister = '//entper-fil01/2groups/WAIO Drill and Blast/MASTER/JimblebarPatternGUID.csv';

$VULCAN_EXE = $ENV{VULCAN_EXE};

# List of Blast Types
#--------------------
#("Production”,”Contour”,”Secondary – O/S”,”Secondary – Toe”);

# Lookup the 1 char blast Type
%lublasttype = (
	'Production'     => 'N' ,
	'Contour'        => 'C' ,
	'Secondary'      => 'S' ,
	'L'              => 'L' ,
	'Ramp'           => 'R' ,
	'Trim'           => 'T' ,
	'F'              => 'F' ,
	'X'              => 'X' ,
	'Unknown'        => '0' 
	);
	
foreach my $key (keys %lublasttype)
{
	$ludbsblasttype{$lublasttype{$key}} = $key;	
}

#@blasttypelist = ("0","N","L","R","C","T","F","X");
@dbsblasttypelist = ('Production','Contour','Secondary'); 

@defhardnesslist = (1,2,3,4,5);

my $mapfile = "_dandb.map";
my $bmmfile = "_dandb.bmm";
my (%holeinstructions,%holefeatures,$dbsoutfile,$fmsoutfile,$fmsoutfileaqm,$bhoutfile,%blastids);
my (@bhorebodylist,@bhpitlist,%mq2minesitebypit,%bhmq2pit,@mq2pitlist,@mq2sitelist,%mq2pitbybhobpit,@mergedpitlist);
my ($mq2_pit_id,$mq2_mine_site);

$PI = 3.141592654;

# global data structure
# ---------------------
$csvheader =  "HOLE ID,COLLAR X,COLLAR Y,COLLAR Z,BEARING,ANGLE,DEPTH,SUBDRILL,DIAMETER,BURDEN,SPACING,SG,HARDNESS,HOLE TYPE,STRATNUM,BLAST NAME";
@output2csv = (1,      1,       1,       1,       1,      1,    1,    1,       1,       1,     1,      1, 1,       0,        1,       0);

@csvheaderlist = split(",",$csvheader);
for my $i (0..$#csvheaderlist)
{
	$headerpos{uc($csvheaderlist[$i])} = $i;
	$DBScol[$i] = -1;
}

$path = cwd();

&loadDefaults;


my $done = 0;
$optexport = 1;
my $panelmessage = "";
my $bmhashardnum = 0;

while (not $done)
{
	#Lava::Report "paths bmfpath $bmfpath tripath $tripath";
	$toggleABDT = 0;
	my $panel1 = new Lava::Panel;
	$panel1->radio_button(1,"STORE INSTRUCTIONS ON HOLES", \$optstoreinstructions);
	if ($ABDT)
	{
		$panel1->radio_button(1,"DISABLE Surface Manager options", \$toggleABDT);
	}else {
		$panel1->radio_button(1,"ENABLE Surface Manager options", \$toggleABDT);
	}
	$panel1->on_side;
	$panel1->text(" ");
	$panel1->radio_button(1,"EXPORT TO CSV ", \$optexport);
	#$panel1->on_side;
	$panel1->if($optexport == 1);
		$panel1->text("Instructions: ",hi);
		if ($defsg <= 0)
		{
			$panel1->text("    Default SG must be specified and > 0","hi");	
		}
		
		if (!($defhardness ~~ @defhardnesslist)) {
			$panel1->text("    Default Hardness must be one of @defhardnesslist","hi");
		}
		$panel1->text("    Click OK. Select any Blast Hole in the required Blast.");
		$panel1->text("    Optionally Select a Blast Outline Polygon (e.g. from Blastmaster). ");	
		$panel1->text(" ");
		$panel1->text("Directory Paths",hi);
		$panel1->item("Block Model   ",\$bmfpath,300);
		$panel1->item("Hardness File ",\$stratpath,300);
		$panel1->item("Solid Tri     ",\$tripath,300);
		$panel1->item("CSV           ",\$csvpath,300);
		$panel1->text(" ");
		$panel1->logical_button("Output for Blast Logic (generates GUID if required)",\$blastlogic);
		$useregistryforguid = 0;
        #$panel1->if($blastlogic == 1);
		#$panel1->logical_button("Use CSV Registry for PATTERN_GUID if not found in Blastholes",\$useregistryforguid);
		#$panel1->if($useregistryforguid == 1);
		#	$panel1->item("GUIDRegistry  ",\$patternguidregister,300);
		#$panel1->endif();	
		#$panel1->endif();
		$panel1->text(" ");
		$panel1->numeric("Blast/Bench digits 3 or 4",\$blastdigits ,1,0);
		$panel1->item   ("Default Hardness number  ",\$defhardness ,1);
		$panel1->pick_list_data(@defhardnesslist);
		$panel1->numeric("        Default SG",\$defsg ,5,2);
		$panel1->on_side; 
		$panel1->logical_button("Ignore subdrill for Volume and Solids",\$ignoresubdrill);
		$panel1->text(" ");
		#$panel1->logical_button("Jimblebar FMS output format",\$jmbformat);
		$jmbformat = 1;
		$pushbackinname =0;
		#$panel1->logical_button("    Include Pushback in DBS file name? ",\$pushbackinname);
		#$panel1->logical_button("Use FEATURE Code for missing HOLE TYPEs? ",\$holetypefromfeature);
		$holetypefromfeature = 0;
		
		$panel1->text("FMS  ",hi);
		$panel1->logical_button("Export for FMS?",\$fmsout);
		$panel1->if($fmsout == 1);
		$panel1->item("FMS CSV Path   ",\$fmscsvpath,300);
		$panel1->endif();
		$panel1->text(" ");
		
		$panel1->text("SETOUT  ",hi);
		$panel1->logical_button("Export for Survey SETOUT?",\$surveyout);
		$panel1->if($surveyout == 1);
			$panel1->item("SETOUT CSV Path",\$surveycsvpath,300);
		$panel1->endif();
		$panel1->text(" ");
		if ($ABDT)
		{
			$panel1->text("Surface Manager ",hi);
			$panel1->logical_button("Surface Manager outputs within geo fence polygon?",\$abdtout);
			$panel1->if($abdtout == 1);
				$panel1->logical_button("  Use internal fences?",\$internalfences);
				$panel1->on_side;
				$panel1->item   ("SM CSV Path    ",\$abdtcsvpath,300);
				$panel1->numeric("Minimum segment length",\$fencedist,4,1);
				$panel1->text(" metres ( 0 to disable checking )");
				$panel1->on_side;
			$panel1->endif();
			$panel1->text(" ");
		} else {
			$abdtout = 0;
		}
		if ($enablebhout)
		{
			$panel1->text("BLASTHOLES  ",hi);
			#$panel1->logical_button("Export for BH (Final Collar only)?",\$bhout);
			$panel1->logical_button("Export for Blastholes?",\$bhout);
			$panel1->if($bhout == 1);
				$panel1->item("BH CSV Path",\$bhcsvpath,300);
			$panel1->endif();
			$panel1->text(" ");
		} else {
			$bhout = 0;
		}
	$panel1->endif();
	
	if ($panel1->execute("Version: $Version Publish_Drill_Pattern")) 
	{
		#Lava::Report "paths bmfpath $bmfpath tripath $tripath";
		
		Lava::Report("\n\nPublish_Drill_Pattern Version:  $Version\n===================================");
		if ($optstoreinstructions)
		{
			&storeinstructions;
		
		} elsif ($toggleABDT) {
			if ($ABDT)
			{
				$ABDT = 0;
			}else {
				$ABDT = 1;
			}
			$optexport = 1;
			
		} elsif ($defsg <= 0 or !($defhardness ~~ @defhardnesslist)) {
			# loop until SG specified
			
		} else {
		
			# ----------------------------------------------------------------
			# check all referenced directories exist and build lists of files 
			# ----------------------------------------------------------------
			my $curdir = ".";
			my $errors = 0;
			
			$bmfpath       = "." if (!$bmfpath);
			$stratpath     = "." if (!$stratpath);
			$tripath       = "." if (!$tripath);
			$csvpath       = "." if (!$csvpath);
			$fmscsvpath    = "." if (!$fmscsvpath);
			$surveycsvpath = "." if (!$surveycsvpath);
			$abdtcsvpath   = "." if (!$abdtcsvpath);
			$bhcsvpath     = "." if (!$bhcsvpath);
			
			# get rid of backspaces in paths
			$bmfpath       =~ s#\\#/#g;
			$stratpath     =~ s#\\#/#g;
			$tripath       =~ s#\\#/#g;
			$csvpath       =~ s#\\#/#g;
			$fmscsvpath    =~ s#\\#/#g;
			$surveycsvpath =~ s#\\#/#g;
			$abdtcsvpath   =~ s#\\#/#g;
			$bhcsvpath     =~ s#\\#/#g;
			$patternguidregister =~ s#\\#/#g;
			
			my $slash;
			
			if (opendir(DIR, "$bmfpath")) 
			{
				@bmf = sort grep { /.bmf$/ && -f "$bmfpath/$_" } readdir(DIR);
		  		closedir DIR;
			} else {
				$slash ="";$slash = '\\' if ($bmfpath =~ /^\\/);
				Lava::Error("Cannot opendir ${slash}$bmfpath: $!");
				$errors++;
			}
			
			if (opendir(DIR, "$stratpath")) 
			{
				@stratcsv = sort grep { /.csv$/ && -f "$stratpath/$_" } readdir(DIR);
		  		closedir DIR;
			} else {
				$slash ="";$slash = '\\' if ($stratpath =~ /^\\/);
				Lava::Error("Cannot opendir ${slash}$stratpath: $!");
				$errors++;
			}
	
			if (opendir(DIR, "$tripath")) 
			{
				@trilist = sort grep { /.00t$/ && -f "$tripath/$_" } readdir(DIR);
		  		closedir DIR;
			} else {
				$slash ="";$slash = '\\' if ($tripath =~ /^\\/);
				Lava::Error("Cannot opendir ${slash}$tripath: $!");
				$errors++;
			}
		
			if (opendir(DIR, "$csvpath")) 
			{
		  		closedir DIR;
			} else {
				$slash ="";$slash = '\\' if ($csvpath =~ /^\\/);
				Lava::Error("Cannot opendir ${slash}$csvpath: $!");
				$errors++;
			}
			
			if ($fmsout)
			{
				if (opendir(DIR, "$fmscsvpath")) 
				{
			  		closedir DIR;
				} else {
					$slash ="";$slash = '\\' if ($fmscsvpath =~ /^\\/);
					Lava::Error("Cannot opendir ${slash}$fmscsvpath: $!");
					$errors++;
				}
			}
			
			if ($surveyout)
			{
				if (opendir(DIR, "$surveycsvpath")) 
				{
			  		closedir DIR;
				} else {
					$slash ="";$slash = '\\' if ($surveycsvpath =~ /^\\/);
					Lava::Error("Cannot opendir ${slash}$surveycsvpath: $!");
					$errors++;
				}
			}
			
			if ($abdtout)
			{
				if (opendir(DIR, "$abdtcsvpath")) 
				{
			  		closedir DIR;
				} else {
					$slash ="";$slash = '\\' if ($abdtcsvpath =~ /^\\/);
					Lava::Error("Cannot opendir ${slash}$abdtcsvpath: $!");
					$errors++;
				}
			}
			
			if ($bhout)
			{
				if (opendir(DIR, "$bhcsvpath")) 
				{
			  		closedir DIR;
				} else {
					$slash ="";$slash = '\\' if ($bhcsvpath =~ /^\\/);
					Lava::Error("Cannot opendir ${slash}$bhcsvpath: $!");
					$errors++;
				}
			}
			
			if (!$errors)
			{
				if (&insertDBSspec)
				{
					my ($layername,$blastname,$fencecount);
					%blastids = ();
					($layername,$blastname,$internalfencecount) = &getbmfandinputs;
					
					if ($layername and $blastname)
					{
						# reset memory storage
						%holedata= ();
						
						if (&runDBSreport($layername,$blastname))
						{
							$solidscount = &makesolidtris($tripath,$solidtri,$layername);
							if ($solidscount)
							{
								$solidsvol = getsolidsvolume($tripath);
							} else {
								$setbmfvolume = 0;
							}
							
							if ($flagbmf  and &existsbmf($bmfpath,$bmffile,1))
							{
								if (&exporttomapfile($mapfile))
								{
									if (&flagmapbmf($mapfile,"${bmfpath}\\${bmffile}"))
									{
										&flagmapstrat() if ($sethardness);
									}
								}
							}
							
							# use block model even if flagging did not work
							($bcm,$tonnes) = &setbmfvolumetonnes("${bmfpath}\\${bmffile}",$tripath) if ($setbmfvolume and &existsbmf($bmfpath,$bmffile,0));	
							
							# now we have all blast holes data in memory 
							my $count = 0;
							if ($blastlogic)
							{
							    $count = &blastlogicwritecsv($blastname);
							} else
							{
							    $count = &dbswritecsv($blastname);    
							}
							if ($count)
							{
								# for now output both fms formats aqm and csv
								&fmswriteaqm($mq2_pit_id) if ($fmsout);
								
								&fmswritecsv($mq2_pit_id) if ($fmsout);
									
								&surveywritecsv($pit) if ($surveyout);
								
								if ($abdtout)
								{
									# output Trimble file
									&geofencewritetrimbledxf($pit);
									if ($internalfencecount == 0)
									{
										&geofencewritecsv($pit,0,"");
										&abdtwritecsv($pit,0,"");	
									} else {
										for my $poly (1..($internalfencecount))
										{
											&geofencewritecsv($pit,$poly,"_${poly}of${internalfencecount}");
											&abdtwritecsv($pit,$poly,"_${poly}of${internalfencecount}");
										}
									}
								}
								
								if ($bhout)
								{
									if (1 or $surveytype eq "FINALCOLLAR")
									{
										&bhwritecsv($mq2_pit_id);
									} else {
										Lava::Report "\n WARNING Blastholes file not written. Only available for FINAL COLLAR\n";	
									}
								}
								
								&openinexcel($count,$internalfencecount);
							}
						}
						Lava::Show(" Finished");
						$done = 1;
					}
				}
				&saveDefaults;
			}
		}	
	} else {
		$done = 1;
	}
}


sub storeinstructions {
# -----------------------------------------------
# store an instructions comment at the end of the object text 
#
	my (@instructions,$instruction,$istext,$bhole,$pattern,$txt,$previnstruction);
	
	my $object = new Lava::Selection ("Select Blast Layer","single");
	if($object->id >= 0)
    {
		$layername = $object->layer();
	}
	undef $object;
	
	if ($layername)
	{	
		# load existing objectids for text objects
		for (my $object=new Lava::Selection ("by layer",$layername); $object->has_more; $object->next) 
		{	
		
			if ($object->description =~ /^Instruction on hole (\d+) pattern (\S+)/)
	        {
	        	$pattern = $2;
	        	$bhole = $object->name;
		        $keyholeid = sprintf("%06d",$bhole);
	        	$instructions{"${pattern}_$keyholeid"} = $object->text->i(0); 
	        	#Lava::Report("Instruction found hole $bhole in $pattern $instructions{"${pattern}_$keyholeid"}");
			}
		}

		$more = 1;
		while ($more) 
		{ 
			my $object = new Lava::Selection ("Select Hole or Existing Instruction Text ","single,shadow");
	        
	        if($object->id < 0)
	        {
	        	$more = 0;
	        	
	        } else {
	        	
	        	$pattern = "";
	        	$istext = 0;
				if ($object->description =~ /^Blast hole in (\S+)/)
		        {
		        	$pattern = $1;
		        	
		        } elsif ($object->description =~ /^Instruction on hole (\d+) pattern (\S+)/) 
		        {
		        	$istext = 1;
		        	$pattern = $2;
		        	
		        } else {
		        	Lava::Error("Not a hole or instruction text: $object->description");
		    	}	
		        	
		        if ($pattern)
		        {	
		        	$bhole = $object->name;
		        	$keyholeid = sprintf("%06d",$bhole);
		        	
		        	#Lava::Report("hole $bhole in $pattern istext $istext");
		        	
		        	if (exists $instructions{"${pattern}_$keyholeid"})
		        	{
		        		$instruction = $instructions{"${pattern}_$keyholeid"}; 
		        	} else {
		        		$instruction = $previnstruction;
		        	}
		        	
		        	my $paneli = new Lava::Panel;
		        	$paneli->text("Instruction for $pattern hole:$bhole",hi);
					$paneli->text("  ");
		        	$paneli->item("Instruction",\$instruction,15);
				
					if ($paneli->execute("Instruction for $bhole")) 
					{
						$ObjectLayer = new Lava::Layer $layername;
						$instructions{"${pattern}_$keyholeid"} = $instruction;
						$previnstruction = $instruction;
						
						if ($istext)
						{
							# if text selected just update it
				        	$object->text->i(0,$instruction);		
				        	$object->replace;
						
						} else {
							# need to create a new text object
							my $points = $object->coordinates()->n;
							if ($points > 0) {
						     	my $coords = $object->coordinates();
								my ($xp,$yp,$zp) = $coords->i(0);
								$xp = $xp + 0.5;
								
								$txt = " $instruction";
								my $Nodetext = new Lava::Obj "text";
								$Nodetext->name("$bhole");
								$Nodetext->description("Instruction on hole $bhole pattern $pattern"); 
								my $Nodetextcoords = $Nodetext->coordinates;
								$Nodetextcoords->i(0,$xp,$yp,$zp);
								$Nodetext->colour(1);
								$Nodetext->text->font(4);
								$Nodetext->text->i(0,$txt);
								$ObjectLayer->add($Nodetext);
							}
						}
						$ObjectLayer->edited(1);			
		        	}
				}
			}
			undef $object;			
		}						
	}
}


sub getbmfandinputs {
#-------------------------------------------------------
# get blast attributes and block model name for flagging
#
	my ($selectedBMblast,$blastname,$objectid,$layername,$BMLayername,$ObjectLayer,
	   	$bhpit,$bhbenchrl,$bhblast,$cancelled,$keyholeid,$pattern,$description,$internalfencecount,@fencepatterns);	
	
    # look for a hole in the layer and get blastname
    $cancelled = 0;
    while (!$layername and !$cancelled)
    {
		$orebody   = $deforebody;
		$pit       = $defpit;
		$pushback  = $defpushback;
		$benchrl   = 0;
		$blasttype = "N";
		$blast     = 0;
		$solidsvol = $bcm = $tonnes = $dandbvolume = 0;
		
		undef $object;
		
		@VertexList = (); 
		$internalfencecount = -1;
		my $loop = 1;
		$selectedBMblast =0;
		my $invalidfence = 0;
		%saveobjectpattern = ();
		
		
		while($loop)
		{
			$selmessage = "Optionally Select a Blast outline (Blastmaster) polygon for Attributes";
			$selmessage = "Select a Geo Fence Master polygon" if ($abdtout);
			$selmessage = "Optionally Select a Geo Fence Internal polygon?" if ($abdtout and $internalfencecount == 0);
			$selmessage = "Select another Geo Fence Internal polygon or Cancel?" if ($abdtout and $internalfencecount > 0);
			Lava::Show("$selmessage"); 
			sleep 1;
			
			my $object = new Lava::Selection ($selmessage,"single,shadow"); 
			
			if($object->id < 0)
	        {
	        	$loop = 0;
	        
	    	} elsif ($object->description =~ /Blast hole in (\S+).*/){
	        	Lava::Error("Blast Hole selected. Cannot be used for Attributes");
	        	
	        } else {
				$selectedBMblast = 1;
				$BMLayername = $object->layer();
				$ObjectLayer = new Lava::Layer $BMLayername;
				# keep the object id so we can update this object later
				$objectid = $object->id;
					      			      	
				# attempt to read attributes
				($format,$orebody,$pit,$pushback,$benchrl,$blocktoe,$blasttype,$blast,$blockname,$blockheight,$benchheight,$group) = &getcodes(\$object);
			
				# store the Geo Fence coordinates
				$Boundverts = 0;
				
				if ($abdtout)
				{
					my ($fencedistcount,$dist);
					my $coords = $object->coordinates;
					$points = $coords->n;
				    if ($object->is_poly and $points > 0 and $points <= $maxfencepoints) 
				    {
						$internalfencecount++;
						if ($internalfencecount)
						{
							$saveobjectpattern{$object->layer()}{$object->id()} = $object->pattern;
							$object->pattern(4);
							$object->replace;
						} else {
							# keep track of colour and linetype for dxf output of main fence
							$fencecolour = $object->colour();
							$fencelinetype = $object->line();	
						}
				        for ($i=0; $i<$points; $i++) {
				        	my ($x1,$y1,$z1) = $coords->i($i);
				        	my $j = $i +1;
				 			$j = 0 if ($j == $points);
				        	my ($x2,$y2) = $coords->i($j);
				        	
				        	if (abs($x1 - $x2) < 0.01 and abs($y1 - $y2) < 0.01)
				        	{ 
				        		Lava::Report "Fence polygon:$internalfencecount Skipping duplicate point: " . ($i +1);
				        	} else {
				            	($VertexList[$internalfencecount][$Boundverts]) = [$x1,$y1,$z1]; 
				            
					            # check close points
					            if ($fencedist)
					            {
					            	$dist = sqrt(($x1 - $x2)**2 + ($y1 - $y2)**2);
					            	if ($dist < $fencedist and $dist >0) # don't report duplicate last point
					            	{
										Lava::Report " Fence points too close. Point: " . ($i +1) . " To " . ($j+1) . " Distance: " . sprintf("%.2f",$dist) ;
										$fencedistcount++;			            		
					            	}
					            }
					            $Boundverts++;
					        }
				        }
				        Lava::Error "$fencedistcount points on Fence are too close. See Report Window." if ($fencedistcount);
				        
				    } else {
				    	my $message = "";
				    	$message .= "Not a polygon." if (! $object->is_poly);
				    	$message .= "\nToo many points. Filter before trying again." if ($points > $maxfencepoints);
				    	Lava::Error "Invalid Geo Fence polygon points: $points (max = $maxfencepoints) " . $message;
				    	$invalidfence = 1;
				    }
				} 
			}
			$loop = 0 if (!$abdtout or !$internalfences or $invalidfence);
		}
		
		# if we are using internal fences then do crossing checks
		my ($crossingerrors);
		if ($internalfencecount)
		{
			&resetselected;
			for my $i (0..($internalfencecount-1))
			{
				
				for my $j (($i+1)..$internalfencecount)
				{
					if ($i ==0)
					{
						# check internal fence has all points inside Master
						if (! &checkinside(\@{$VertexList[$i]},\@{$VertexList[$j]}))
						{
							Lava::Error "Internal Fence $j not inside Master";
							$crossingerrors++;
						}
					} else {
						# check internals don't cross
						Lava::Report "Checking crossing on fences $i and $j";
						if (! &checkcrossing(\@{$VertexList[$i]},\@{$VertexList[$j]}))
						{
							Lava::Error "Internal Fences cross: $i and $j";
							$crossingerrors++;
						}
					}	
				}
			}	
		}
		return "","",0 if ($crossingerrors or $invalidfence);
		
		Lava::Show("Select a Hole in Blast Layer");   
		sleep 1; 
		undef $object;
		$cancelled = 1;
		for (my $object=new Lava::Selection ("Select a Hole in Blast Layer","single,shadow");$object->has_more;$object->next) {	
			$cancelled = 0;
			# check if object is a valid blast hole 
			if ($object->description =~ /Blast hole in (\S+).*/)
			{
				# allow underscores and extra token on Vulcan blast name
				$pattern = $1;
				
				$layername = $object->layer();
				$description = $object->description;
				
				($bhpit,$bhbenchrl,$bhblast) = split(/[_-]/,$pattern);
				if ($bhpit and $bhbenchrl and $bhblast)
				{
					$blastname = "$bhpit-$bhbenchrl-$bhblast" ;
				
				} else {	
					# not a valid pattern name
					($bhpit,$bhbenchrl,$bhblast) = split(/[_-]/,$layername);
					if ($bhpit and $bhbenchrl and $bhblast)
					{
						$blastname = "$bhpit-$bhbenchrl-$bhblast" ; 
					} else {
						$blastname = "$pattern";	
					}
				}
			} else {
				Lava::Error("Not a Blast Hole. Please try select again or Cancel");		
			}
		}
	}
	
	# check that attributes from blast hole match BM
	my $panela = new Lava::Panel;
	my $warningcount = 0;
	$updateBM = 0;
	
	if ($selectedBMblast)
	{
		if ($pit ne $bhpit)
		{
			$panela->text("WARNING Blast Hole Pit:$bhpit does not match Outline Pit:$pit");
			$warningcount++;
		}
		if ($benchrl != $bhbenchrl)
		{
			$panela->text("WARNING Blast Hole BenchRL:$bhbenchrl does not match Outline BenchRL:$benchrl");
			$warningcount++;
		}
		if ($blast != $bhblast)
		{
			$panela->text("WARNING Blast Hole Blast:$bhblast does not match Outline Blast:$blast");
			$warningcount++;	
		}
	}

	# use values from blast hole
	$pit     = $bhpit      if ($bhpit);
	$benchrl = $bhbenchrl  if ($bhbenchrl);
	$blast   = $bhblast    if ($bhblast);
	
	# set oblasttype from polygon 1 char blasttype
	if (defined $ludbsblasttype{$blasttype})
	{
		$oblasttype = $ludbsblasttype{$blasttype};
		#Lava::Report("After Blast type: $blasttype Out Blast Type: $oblasttype");
	} else {
		$oblasttype = 'Production';
	}
	
	$panela->text("Hole Layer: $layername",hi);
	$panela->text("Description: $description",hi);
	$panela->on_side;
	$panela->text("  ");
	$panela->text("Blast Attributes",hi);
    $panela->item     ("  Orebody Name   ",\$orebody,6);
    $panela->pick_list_data(@bhorebodylist); 
    $panela->text("   (   As in Blastholes)");
    $panela->on_side;
    $panela->item     ("  Pit Name       ",\$pit,4);
    $panela->pick_list_data(@mergedpitlist);
    $panela->text("    (used for output pattern name)");
    $panela->on_side;
    if ($pushbackinname)
    {
    	$panela->item     ("  Pushback Name  ",\$pushback,4);
    }
    $panela->numeric  ("  Bench Toe RL   ",\$benchrl ,5,1);
    $panela->text("    (used for output pattern name)");
    $panela->on_side;
	$panela->item     ("  Blast Type     ",\$oblasttype,15);
    $panela->pick_list_data(@dbsblasttypelist);
    $panela->numeric  ("  Blast Number   ",\$blast,4,0);
    $panela->text("    (used for output pattern name)");
    $panela->on_side;
    
    if ($selectedBMblast)
	{
		$updateBM = 1; 
		$panela->logical_button("Update Blast Outline Polygon Attributes? ",\$updateBM);
	}
    $panela->text("  ");	
        
	if ($cancelled or ! $panela->execute("Attributes for Blast: $blastname"))
	{
		return "","",0;	
	}
	
	$blastname = sprintf("%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$benchrl,$blast);
	
	if ($layername and $blastname and ($fmsout || $bhout)) 
	{
		&validatemq2pitid($orebody,$pit); 
	}
	
	
	# update attributes on reference polygons unless it is a blast hole
	# -----------------------------------------------------------------
	if ($selectedBMblast and $updateBM)
	{
		for (my $object=new Lava::Selection ("by layer",$BMLayername); $object->has_more;$object->next) 
		{	
			if ($object->id eq $objectid) {	
            	if ($format ne "SUBBLOCK" and $format ne "BHOLE" and $format ne "PERIOD" and $format ne "BLAST") { $format = "BLOCK"; }
            	$description = "$format ${orebody}\\${pit}\\${pushback}\\${blocktoe}\\${blasttype}${blast}\\${blockname} $benchrl $benchheight";
            	$object->description($description);
            	$object->replace;
				$ObjectLayer->edited(1);
				
				last;
			}
		}
		undef $object;
	}
	
	# reset defaults
	$deforebody      = $orebody;
	$defpit          = $pit;
	$defpushback     = $pushback;
	$defblasttype    = $blasttype;
	
	$pattern_ver = $pattern_guid = $r_guid = $r_ver = "";	
	my $foundregisterguid   = 0;
	my $foundblastholesguid = 0;
	if ($blastlogic)
	{
		if ($useregistryforguid and $patternguidregister)
		{
			($foundregisterguid,$r_guid,$r_ver) = &getguidfromregister($blastname,$patternguidregister);	
		}	
		
		# now check blastholes	
		($foundblastholesguid,$pattern_guid,$pattern_ver) = &getguidfromblastholes($pit,$benchrl,$blast);	
		if (!$foundblastholesguid and $foundregisterguid)
		{
			$pattern_ver  = $r_ver;
			$pattern_guid = $r_guid;	
		}
    }
    	
	my $prev_ver = $pattern_ver;
	my ($minx,$miny);
						
	if ($layername)		
	{
		# load FEATURE Codes and Instructions
		%holefeatures = ();
		%holeinstructions = ();
		my $parameter_object_found = 0;
		my $Layer = new Lava::Layer $layername;
		
		for (my $object=new Lava::Selection ("by layer",$layername); $object->has_more;$object->next) 
		{	
			if ($object->description =~ /Blast hole in (\S+)/)
            {
            	Lava::Report " Found Vulcan Blast $1" if (!exists $blastids{$1}); 
            	$pattern= $1;
            	$blastids{$pattern} = $object->name() if (! exists $blastids{$pattern});
            	
            	my ($xp,$yp) = $object->coordinates->i(0);
            	$minx = $xp if (length($minx) == 0 or $xp < $minx);
                $miny = $yp if (length($miny) == 0 or $yp < $miny);
            
            	#if ($object->name() =~ /(\d+)/)
            	#{
            	#	$keyholeid = sprintf("%06d",$1);
	            #	$holefeatures{"${pattern}_$keyholeid"}	= $object->feature;
	            #	#Lava::Report(" Hole $keyholeid FEATURE $holefeatures{${pattern}_$keyholeid}") if (length($object->feature)); 
	            #}
		  	
		  	} elsif ($object->description =~ /^Instruction on hole (\d+) pattern (\S+)/)
		  	{
		  		$pattern = $2;
		  		if ($object->name() =~ /(\d+)/)
            	{
            		$keyholeid = sprintf("%06d",$1);
            		if (length($object->text->i(0)))
            		{
	            		$holeinstructions{"${pattern}_$keyholeid"} = $object->text->i(0);
	            		Lava::Report(" Hole $keyholeid INSTRUCTION " . $holeinstructions{"${pattern}_$keyholeid"});
	            	}
	            }
		  	} elsif ($object->name() eq "PARAMETERS")
            {
                $parameter_object_found = 1;
                my (%varhash,$txt_pattern_guid,$txt_pattern_ver);
                for my $i (0..($object->text->n -1))
                {
                    my ($var) = split(":", $object->text->i($i));
                    $varhash{$var} = substr($object->text->i($i),length($var)+1);
                    Lava::Report "Read from PARAMETERS Object $var = $varhash{$var}";
                }   
    			$txt_pattern_guid = $varhash{"GUID"} if (exists $varhash{"GUID"});
    			$txt_pattern_ver  = $varhash{"VER"}  if (exists $varhash{"VER"});
    			
    			my $panelv = new Lava::Panel;
    			my $guidsource = "";
    			if ($foundblastholesguid)
    			{
    			    $guidsource = "from Blastholes";
    			    
    			} elsif ($foundregisterguid)
    			{
    				$guidsource = "from Registry";
    				
    			} elsif ($txt_pattern_guid)
    			{
    			    $pattern_guid = $txt_pattern_guid;
    			    
    			    $guidsource = "From Text Object";    
    			}
    			$pattern_ver = max($pattern_ver,$txt_pattern_ver,1);
    			$panelv->text   ("PATTERN_GUID ${guidsource}  : $pattern_guid") if ($guidsource);
    			$panelv->text   (""); 
    			$panelv->text   ("PATTERN_VER  from Blastholes: $prev_ver") if ($foundblastholesguid); 
    			$panelv->text   ("PATTERN_VER  from Registry  : $r_ver") if ($foundregisterguid); 
    			$panelv->text   ("PATTERN_VER  from Object    : $txt_pattern_ver"); 
    			$panelv->text   ("");
    			$panelv->numeric("PATTERN_VER  ",\$pattern_ver,4,0);
    			
    			if ($panelv->execute("Change Version for: $blastname")) 
    			{
					$pattern_guid = &checkguid($pattern_guid);
    			    if ($useregistryforguid and $patternguidregister and (!$foundregisterguid or ($prev_ver ne $pattern_ver)))
    			    {
        			    &writeguidtoregister($blastname,$pattern_guid,$pattern_ver,$patternguidregister);
        			}

        			$object->text->i(0,"Blast:$blastname");
		            $object->text->i(1,"GUID:$pattern_guid");
        			$object->text->i(2,"VER:$pattern_ver");
        			$object->replace;
        			$Layer->edited(1);
            	}
            }
		}	

		# if no PARAMETER object exists then create it
		# --------------------------------------------
		if ($blastlogic and not $parameter_object_found)
		{
			$pattern_ver = max($pattern_ver,1);
			
			$pattern_guid = &checkguid($pattern_guid);
		    if ($useregistryforguid and $patternguidregister and (!$foundregisterguid or ($prev_ver ne $pattern_ver)))
		    {
			    &writeguidtoregister($blastname,$pattern_guid,$pattern_ver,$patternguidregister);
			}
        			
		    # add attribute object
            my $Nodetext = new Lava::Obj "text";
			$Nodetext->name("PARAMETERS");
			$Nodetext->description("Parameters storage for Layer"); 
			my $Nodetextcoords = $Nodetext->coordinates;
			$Nodetextcoords->i(0,$minx,$miny-100,$benchrl);
			$Nodetext->colour(1);
			$Nodetext->text->font(4);
			$Nodetext->text->i(0,"Blast:$blastname");
			$Nodetext->text->i(1,"GUID:$pattern_guid");
			$Nodetext->text->i(2,"VER:$pattern_ver");
			$Layer->add($Nodetext);
    		$Layer->edited(1);	
	    }
	    
        my $panel = new Lava::Panel;
        if ($typedesign)
        {
        	$typefinal = 0;	
        } else {
        	$typefinal = 1;	
        }
        # check that the previous bmf exists in current bmf directory
        $bmffile = &checkinlist($bmffile,"",\@bmf);
        
        # check if current solid name matches current blast otherwise change default
        if ($solidtri !~ /${blast}/)
        {
        	$solidtri = "solid${blast}.00t";
        }
        
        # check that the previous solidtri exists in current Solids directory
        $solidtri = &checkinlist($solidtri,"",\@trilist);
        
        $panel->text("Survey Type",hi);	
		$panel->radio_button(1,"    DESIGN     ", \$typedesign);
		$panel->radio_button(1,"    FINALCOLLAR", \$typefinal);
		$panel->on_side;
        $panel->text("  ");	
        $panel->text("Block Model Path: $bmfpath",hi);
		$panel->item("Block Model File  ",\$bmffile,200);
		$panel->pick_list_data(@bmf);
		$panel->text("  ");
        $panel->logical_button("Flag Blast Holes from Block Model? ",\$flagbmf);
		$panel->if($flagbmf == 1);
			$panel->text("  ");
			$panel->logical_button("Set hardness from Stratnum CSV file? ",\$sethardness);
			$panel->if($sethardness == 1);
				$panel->text("Path: $stratpath");
				$panel->item("Stratnum CSV File ",\$stratnumcsv,200);
				$panel->pick_list_data(@stratcsv);
			$panel->endif();
			$panel->text("  ");
			#$panel->logical_button("Use triangulations and block model for Blast Tonnes and Volume? ",\$setbmfvolume);
			#$panel->if($setbmfvolume == 1);
		$panel->endif();
		$panel->logical_button("Get macro to generate a blast solid for blast tonnes and volume? ",\$makesolid);
		$panel->if($makesolid == 1);
			$panel->text("   Path: $tripath");
			$panel->numeric("   Span limit factor",\$spanlimitfactor,5,2);
			$panel->text("  ");
		$panel->else();			
			$panel->item("Blast Solid       ",\$solidtri,200);
			$panel->pick_list_data(@trilist);
			#panel->endif();
			#$solidtri = ""; # disabled option to enter solid name
		$panel->endif();
		$panel->text("  ");
		
		if ($panel->execute("Flagging Options for Blast: $blastname")) 
		{
			# reset blast type code from selected long name
			# ---------------------------------------------
			if (defined $lublasttype{$oblasttype})
			{
				$blasttype = $lublasttype{$oblasttype};
				#Lava::Report(" Blast type: $blasttype Out Blast Type: $oblasttype");
			} else {
				$blasttype = 'N';
			}
			
			# make creating solid independent of flagging bmf
			# hard code $setbmfvolume based upon $makesolid
			# if ($flagbmf and ($makesolid or $solidtri))
			if ($makesolid or $solidtri)
			{
				$setbmfvolume = 1;
			} else {
				$setbmfvolume = 0;
			}
			
			#$blastname = sprintf("%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$benchrl,$blast);
			
			if ($typedesign)
			{
				$surveytype = "DESIGN"
			} else {
				$surveytype = "FINALCOLLAR"
			}
			
			return $layername,$blastname,$internalfencecount;
		
		} else {
			return "","",0;	
		}
	}	
}

sub getguidfromblastholes {
# ----------------------------------------------
# validate the pitid 
#
	my ($bhpit,$bhbenchrl,$bhblast) = @_;
    substr($temp,1,length($temp)-2);
    
    # get last 2 chars as pit for BHs
    my $pitlength = length($bhpit);
    $bhpit = substr($bhpit,$pitlength-2,2) if ($pitlength > 3);
    
    $bhbenchrl = sprintf("%0${blastdigits}d",$bhbenchrl);
    $bhblast   = sprintf("%0${blastdigits}d",$bhblast);
     
    my ($guid,$ver);
    my $found = 0;
    
	my $message2 = "";
	
	my $Conn = Win32::OLE-> new('ADODB.Connection');

	$Conn->Open($ConnStrBH);
	my $err = Win32::OLE::LastError();
	if (not $err eq "0") 
	{ 
		Lava::Report "Error: " . Win32::OLE::LastError() . "\n";
		$message = "Blastholes get GUID from BH_PATTERN_GUIDs FAILED";
	
	} else 
	{
		$sql = 	"SELECT SYS.STANDARD.TO_CHAR(PATTERN_GUID) AS PGUID, DESIGN_VERSION FROM BH_PATTERN_GUIDS G " .
				"LEFT JOIN BH_PATTERNS P on G.PATTERN_ID = P.PATTERN_ID " .
				"WHERE P.PATTERN_OR_FLITCH = 'P' " .
				"AND P.OREBODY = '$orebody' AND P.PIT = '$bhpit' and P.BENCH = '$bhbenchrl' and P.PATTERN = '$bhblast' " .
			   	"ORDER BY DESIGN_VERSION";
		
		Lava::Report "$sql";
		
		if(! ($RS = $Conn->Execute($sql)))
		{ 
			$message2 = "SQL failed: " . Win32::OLE->LastError(); 
			Lava::Report($message2);
		
		} else 
		{
			while (! $RS->EOF) 
			{
				$guid = oracle2sqlguid($RS->Fields(0)->value);
				$ver  = $RS->Fields(1)->value;
				$found = 1;
				Lava::Report(" Found GUID: $guid  VER: $ver");
				$RS->MoveNext; 
			}
			$RS->Close;
		}
		
		$Conn->Close;
	}
	if ($found)
	{
		
	} else 
	{
		Lava::Report("GUID not found in Blastholes for OREBODY = '$orebody' AND PIT = '$bhpit' and BENCH = '$bhbenchrl' and PATTERN = '$bhblast'");
	}	
	return ($found,$guid,$ver);
}



sub getguidfromregister {
#------------------------------------------------------------------------------------------
# read the most recent GUID used for a matching pattern
#
    my ($name,$csvin) = @_;
    
    $name = uc($name);
    my ($guid,$ver);
    my $found = 0;
    
    if (-f $csvin and tie(@data, 'Tie::File', $csvin))
    {
        # search from end of file upwards to find last matching guid
        for (my $i=$#data; $i>=0; $i--) 
        {
            if ($data[$i] =~ /^${name},.+/)
            {
                Lava::Report "Found $name in $csvin at line $i";
                $found = 1;
                ($temp,$guid,$ver) = split(",",$data[$i]);
                $ver = 1 if (!$ver);
                Lava::Report(" Found GUID: $guid  VER: $ver");
                last;
            }     
        }
        
        untie @data;
    } else
    {
        Lava::Error "Problem with GUID register: $csvin";     
    }
    
    return ($found,$guid,$ver);
}

sub checkguid {
#------------------------------------------------------------------------------------------
# generate new guid if require and make sure it is correct format
    my ($guid) = @_;
    
    if (! $guid)
    {
        my $temp = Win32::GuidGen();
        $guid = substr($temp,1,length($temp)-2);
    
    } elsif ($guid !~ /.+-.+/)
    {
    	# not SQL format
    	mu $oldguid = $guid;
    	Lava::Report "Reformating GUID	from $oldguid to $guid";
    }
    return $guid;
}

sub writeguidtoregister {
#------------------------------------------------------------------------------------------
    my ($name,$guid,$ver,$csvin) = @_;
    
    my $user = $ENV{USERNAME};
    $datetime = &format_time("datetime");

	if (open(GUID, ">>$csvin"))
	{
        print GUID "$name,$guid,$ver,$user,$datetime\n";
        close GUID;
        Lava::Report "New row written to Registry: $guid  VER: $ver\n"; 
    } else
    {
        Lava::Error "Problem writing to GUID register: $csvin";     
    }
}

sub resetselected {
#------------------------------------------------------------------------------------------
	my ($pattern,$changed);
	foreach $layername (keys %saveobjectpattern) 
	{
		my $changed = 0;
		my $ObjectLayer = new Lava::Layer $layername;
		for (my $object=new Lava::Selection ("by layer",$layername); $object->has_more;$object->next) {	
			if (exists $saveobjectpattern{$layername}{$object->id}) {	
				my $pattern = $saveobjectpattern{$layername}{$object->id};
				$object->pattern($pattern);	
				$object->replace();
				$changed = 1;
			}
		}
		$ObjectLayer->edited(1) if ($changed);
	}
}

sub checkinlist {
# check that a name is in a filelist else return $def
#
	($name,$def,$filelistref) = @_;

	#Lava::Report(" Looking for $name in @{$filelistref}");
	
	my $return = $def; 
	foreach my $file (@{$filelistref})
	{
		if (uc($file) eq uc($name)) 
		{
			Lava::Report(" Found $file"); # 
			$return = $name;
			last;
		}
	}
	
	return $return;
}


sub writebmmfile {
#-------------------------------------------------
# write the bmm spec file for bmask
	my ($bmffullname) = @_;

	# check if block model has hardnum variable
	my $novars = "3.000";
	my $hardnumname = "hardness";
	$bmhashardnum = 0;
	if ($bm = new vulcan::block_model("$bmffullname", "r")) 
	{
		if ($bm->is_field("hardnum"))
		{
			$hardnumname = "hardnum";
			$novars = "4.000";
			$bmhashardnum = 1;
		} elsif ($bm->is_field("hardness")) 
		{
			$hardnumname = "hardness";
			$novars = "4.000";
			$bmhashardnum = 1;
		
		} elsif ($bm->is_field("hard")) 
		{
			$hardnumname = "hard";
			$novars = "4.000";
			$bmhashardnum = 1;		
		} else {
			$hardnumname = "hardnotfound";
		}
		$bm->close();
		undef $bm;
		Lava::Report " hardness variable: $hardnumname";
	} else {
		Lava::Error "Error opening block model and getting hardness variable";
		return 0;	
	}

	my $now = &format_time("datetime");

	my $out = <<EOS;	
* MAPTEK: Specifications $now
BEGIN\$DEF BLOCK_MASK          
   BMODEL_NAME='$bmffullname'
   NO_MAPIO            
   NOVARS=$novars 
END\$DEF BLOCK_MASK          
BEGIN\$DEF FORMAT_SPEC         
   MAPFIL='_dandb.map'
   MAPFMT='(6X,3F15.4)'
END\$DEF FORMAT_SPEC         
BEGIN\$DEF MASK_VARS           
   VAR_0='density'
   DEF_0=0.000
   VAR_1='desig'
   DEF_1=0.000
   VAR_2='stratnum'
   DEF_2=0.000
   VAR_3='$hardnumname'
   DEF_3=0.000
END\$DEF MASK_VARS           
END\$FILE

EOS
	unlink("$bmmfile") if (-e $bmmfile);
	if (open(BMM, ">$bmmfile"))			   
	{
		print BMM $out;	
		close BMM;
	} else {
		Lava::Error(" Unable to open ${bmmfile}. Could be write permissions or file is open in Excel?");
		return 0;	
	}
	return 1*$novars;
}


sub existsbmf {
#---------------------------------------------------------
# check if bfm fiel exists
	my ($bmfpath,$bmfname,$errorpopup) = @_;
	
	if (-f "${bmfpath}\\${bmffile}")
	{ 	
		return 1;
	} else {
	
		Lava::Error("Block Model Not Found: $bmfname") if ($errorpopup); 
		return 0;	
	}
}


sub flagmapbmf {
#---------------------------------------------------------
	my ($mapfile,$bmffullname) = @_;

	my ($linein, $lineout, @tokens, $holecount);
	my ($colsg,$coldesig,$colstratnum,$colhardness) = (-1,-1,-1,-1);

	if ($flagbmf)
	{
		if (&writebmmfile($bmffullname))
		{
      		my $prog = $VULCAN_EXE . "/bmask.exe $bmmfile";
      		Lava::Report(" \n Running $prog");
      		Lava::Show("Flagging map file from block model");
      		#$status = system $prog;	
      		&myRunCommand($prog,1,1);
      		#if ($status)
      		$bmffullname =~ /^(.+)bmf$/;
      		my $lockfile  = "${1}blk_lock";
      		my $lockfiler = "${1}blk_rlock";
      		if (-f "$lockfile" or -f "$lockfiler")
      		{
      			$bmaskfailed = 1;
      			Lava::Error(" ERROR in bmask");	
      			Lava::Report "Trying to delete $lockfile";
      			unlink "$lockfile" if (-f "$lockfile");
      			Lava::Report "Trying to delete $lockfiler";
      			unlink "$lockfiler" if (-f "$lockfiler");

      		} else {
      			$colsg       = $headerpos{"SG"}         if (defined $headerpos{"SG"});
      			$coldesig    = $headerpos{"DESIG"}      if (defined $headerpos{"DESIG"});
      			$colstratnum = $headerpos{"STRATNUM"}   if (defined $headerpos{"STRATNUM"});
      			$colhardness = $headerpos{"HARDNESS"}   if (defined $headerpos{"HARDNESS"});
      			
      			# read back SG and stratnum from map file
      			# ---------------------------------------	
				if (open(MAPFILE,"<$mapfile"))
				{
					while (<MAPFILE>) {
						chomp;
						$linein = $_;
						
						if ($linein !~ /^\*.*/)
						{
							$linein =~ /\s*(.*)/;
							my ($key,$xc,$yc,$zc,$sg,$desig,$stratnum,$hardnum) = split(/\s+/,$1);
							#Lava::Report "$key,xc,yc,zc,sg,desig,stratnum,hardnum $key,$xc,$yc,$zc,$sg,$desig,$stratnum,$hardnum";
							if (defined $holedata{$key})
							{
								$holedata{$key}[$colsg]       = $sg if ($colsg > -1);
								$holedata{$key}[$coldesig]    = $desig if ($coldesig > -1);
								$holedata{$key}[$colstratnum] = 1*$stratnum if ($colstratnum > -1);
								$holedata{$key}[$colhardness] = 1*$hardnum if ($colhardness > -1);
								$holecount++ if ($sg > 0 and $stratnum > 0);					
							}
						} else {
							#Lava::Report " skipping header rows in map file: $linein"; 	
						}
					}	
					close MAPFILE;
					if ($bmhashardnum)
					{
						Lava::Report(" Holes flagged with valid SG, STRATNUM and HARDNUM: $holecount");
					} else {
						Lava::Report(" Holes flagged with valid SG and STRATNUM: $holecount");
					}
				} else {
					Lava::Error(" Unable to open $mapfile for input");
				}
      		}			
		}	
	}
	
	return $holecount;
}


		
sub flagmapstrat {
#---------------------------------------------------------
# add the strat hardness to the output file	
#
	my ($stratnum,%hardness,$hardnesscode,%reportederror);
	
	my $fullcsvname = "${stratpath}\\$stratnumcsv";
	# open the stratnum file and load hardness for each
	if (open CSVIN, "<$fullcsvname") 
	{
		my $count = 0;
		Lava::Report("\n ======================================");
		while (<CSVIN>)
		{
			chomp;
			(@values) = split ","; 
			if ($values[0] =~ /\d+/) {
				$stratnum = sprintf("%d",$values[0]);
				
				if ($values[1] !~ /\d+/)
				{
					Lava::Report(" Statnum: $stratnum, $values[1] using $defhardness as not set");
					$hardness{stratnum} = $defhardness;	
				} else {
					#Lava::Report(" Statnum: $values[0] set to $values[1]"); 
					$hardness{$stratnum} = $values[1];	
				}
			}
		}
		close CSVIN;
		
		if (!defined $headerpos{"STRATNUM"})
		{
			Lava::Error(" Column STRATNUM does not exists");	
		
		} elsif (!defined $headerpos{"HARDNESS"}) {
			Lava::Error(" Column HARDNESS does not exists");	
		
		} else {
			
			$colstratnum = $headerpos{"STRATNUM"} ;
			$colhardness = $headerpos{"HARDNESS"} ;
			
			foreach $key (keys %holedata)
			{
				$stratnum = sprintf("%d",$holedata{$key}[$colstratnum]);      			
				
				if (defined $hardness{"$stratnum"}) {
					$hardnesscode = $hardness{"$stratnum"}; 
				} else {
					$hardnesscode = 0;
					Lava::Report(" CSV Stratnum $stratnum not found in $stratnumcsv") if (not $reportederror{"$stratnum"});
					$reportederror{"$stratnum"}++;
				}
				$holedata{$key}[$colhardness] = $hardnesscode;
				$count++;
			}
			Lava::Report(" Blockmodel HARDNUM overwritten by STRATNUM HARDNESS") if ($bmhashardnum);
			Lava::Report(" Blastholes flagged with HARDNESS: $count"); 	
		}
		
	} else {
		Lava::Error(" Unable to open $fullcsvname for input");
	}
	return $count;
}


sub createsolid
#=================
{			
	my ($solidtripath,$tri,$layername,$objectname) = @_;
	
	Lava::Report("\nBuilding solid $tri using object $objectname from $layername");
	Lava::Show("Building solid $tri using object $objectname  from $layername");
    
    unlink "$tri" if (-e "$tri"); 
	unlink "$solidtripath\\$tri" if (-e "$solidtripath\\$tri");
	undef $object;
	
	RunMenu("OPENPIT_NBLAST_CREATE_SOLID","abort",
      sub { SelectObjects("$layername","$objectname","",""); },
      sub { PanelResults("solid_limit_factor",
                "button_pressed" => "ok",
                "ignore_subdrill" => "$ignoresubdrill",
                "use_triangulation_defaults" => "1",
                "span_limit_factor" => "$spanlimitfactor"
                   ); },
      		"FINISH");	
    
   $panels = new Lava::Panel;
   $panels->text("Visually Check Solid: $tri");
   $panels->text("");
   $panels->text("Press OK to use Solid for BCM");
   
   if ($panels->execute("Check Solid")) { 
    
	   RunMenu("TRI_UTE_DESELECT","abort",
		    sub { PanelResults("SM_remove_model_underlay",
		    "use_list" => "0",
		    "button_pressed" => "ok",
		    "file_pattern" => "solid*"
		    ); },
		    "FINISH");  		
	    
	    rename "$tri", "$solidtripath\\$tri" if (! -e "$solidtripath\\$tri");
		
		if (! -e "$solidtripath\\$tri")
		{
			return 0;
		} else {
			return 1;
		}
	
	} else {
		return 0;
	}			 
}


sub makesolidtris {
# ------------------------------------------
# returns the number of valid solids
	my ($solidtripath,$solidtri,$layername) = @_;
	
	@solidlist = ();

	my $return = 0;
	
	# do we need to build a new solids
	# --------------------------------
	if ($makesolid)
	{
		#$solidtripath = ".";
		#@solidlist = (keys %blastids);
		#foreach my $i (0..$#solidlist)
		my $i = 0;
		foreach my $pattern (keys %blastids)
		{
			
			#my $objectname = $blastids{"$solidlist[$i]"};
			my $objectname = $blastids{$pattern};
			$solidlist[$i] = "solid${pattern}.00t";  

			if (! &createsolid($solidtripath,$solidlist[$i],$layername,$objectname) )
			{
				Lava::Error("Problem generating solid $solidlist[$i]\n");
				$solidlist[$i] = "";
			} else {	
				$return++;	
			}
			$i++;
		}		
	} else {
		if ($solidtri)
		{
			$solidlist[0] = $solidtri;
			$return = 1;
		}
	}

	return $return;
}


sub getsolidsvolume
#==================
{			
	my ($solidtripath) = @_;
	
	Lava::Report("\nCalculating Solids Volume @solidlist");
	Lava::Show("Calculating Solids Volume @solidlist");
    
   	my $vol = 0;
    my $report = "solids_vol";
	unlink "${report}.txt" if (-e "${report}.txt");
	
	my @filelist;
	foreach my $i (0..$#solidlist)
	{
   		push @filelist,"${solidtripath}\\$solidlist[$i]" if ($solidlist[$i]);
   	}
		
	RunMenu("TRI_SOLID_VOLUME","abort",
      sub { PanelResults("3D Solid Volumes",
                "line" => "",
                "Test for crossing triangles " => "0",
                "button_pressed" => "ok",
                "Test for closure " => "0",
                "Test for consistency " => "0",
                "Select solids by picking" => "0",
                "Density" => "1.0",
                "Select solids by name" => "1",
                "Save volume report to file" => "1",
                "Report file" => "$report"
                   ); },
      sub { PanelResults("SM_tri_list",
                "line" => "",
                "button_pressed" => "ok",
                "has_triangulation" => "1",
                "triangulations" => [@filelist],
                "modify_attributes" => "0",
                "save_selections" => "0"
                   ); },
      sub { PanelResults("TRI_VOLUME",
                "button_pressed" => "ok",
                   ); },
      "FINISH");             
	
	if (open REP,"<${report}.txt") {
    	Lava::Report "Volume Report File ${report}.txt Opened OK ";
    	
    	while (<REP>)
    	{
    		chomp;
    		$linein = $_;
    		if ($linein =~ /Total (.+)/)
    		{	
    			my (@parts) = split (/\s+/,$linein);
				#Lava::Report("data @parts");
				$vol = sprintf("%.1f",$parts[4]);					
			}				
    	} 
    	close REP; 
	
	} else {
		Lava::Report "\n ERROR opening Report File ${report}.txt \n";
      	Lava::Error "\n ERROR opening Report File ${report}.txt \n";
    }

	return $vol;
	    	
}



sub setbmfvolumetonnes {
# ------------------------------------------
	my ($bmffullname,$solidtripath) = @_;
	
	my $resfile = "_dandb.res";
	my $dmpfile = "_dandb.dmp";

	my (@parts,$linein,$bmbcm,$bmtonnes);
	
	unlink "$resfile" if (-e "$resfile");

	if (! open(RES,">$resfile")) 
	{
		Lava::Error(" Unable to open ${resfile}.");
		return 0;	
	
	} else {
		
		my $out = <<EOSRES1; 	
* MAPTEK: Specifications 03-Aug-2013 11:05:39
BEGIN\$DEF GRADE_DENSITY
   NAME='density'
   DEFAULT=0.0
END\$DEF GRADE_DENSITY
BEGIN\$DEF GRADE_1
   NAME='density'
   SUM
   AVERAGE_UNKNOWN
END\$DEF GRADE_1
BEGIN\$DEF DEFAULTS
END\$DEF defaults
EOSRES1
	
	my $region = 0;
	foreach my $i (0..$#solidlist)
	{
		if ($solidlist[$i])
		{
		$region++; 
		$out .= <<EOSRES2; 
BEGIN\$DEF REGION_$region
   NAME='${solidtripath}\\$solidlist[$i]'
   GROUP=' '
END\$DEF REGION_$region
EOSRES2
		}
	}

	$out .= <<EOSRES3; 
BEGIN\$DEF BLOCKSELECTION
   EXACT_VOLUMES
END\$DEF BLOCKSELECTION
BEGIN\$DEF blockselection2
   NO_FULL_BLOCKS
   NO_PARTIAL_BLOCKS
END\$DEF blockselection2
END\$FILE

EOSRES3
	
		print RES "$out\n";
		close RES;
	}	
	
	my $prog = $VULCAN_EXE . "/breserve_v2.exe -o $dmpfile -P $bmffullname $resfile";

	# remove previous .dmp
	if (-f $dmpfile) {
	    unlink $dmpfile;
	}
	
	# execute breserve
	Lava::Report(" \n Running $prog");
	#$status = system $prog;
	&myRunCommand($prog,1,1);
    $bmtonnes = $bmbcm = 0;
	
	if (open DMP,"<$dmpfile") {
    	Lava::Report "Reserves .dmp File $dmpfile Opened OK ";

    	while (<DMP>)
    	{
    		chomp;
    		$linein = $_;
    		if ($linein =~ /.*\.00t\s+(.+)/)
    		{	
    			(@parts) = split (/\s+/,$1);
				#Lava::Report("data @parts");
				$bmtonnes += $parts[2];
				$bmbcm    += $parts[1];					
			}				
    	} 
    	close DMP; 
    	$bmtonnes = sprintf("%.1f",$bmtonnes);
		$bmbcm    = sprintf("%.1f",$bmbcm);
		$bmsg = sprintf("%.2f",$bmtonnes / $bmbcm)  if ($bmbcm > 0);
		Lava::Report "\n From Blockmodel Tonnes: $bmtonnes Volume: $bmbcm  Average SG: $bmsg";
		
		if (($bmaskfailed or !$flagbmf) and ($defsg != $bmsg) and $bmsg > 0)
		{
			my $panelsg = new Lava::Panel;	
			$panelsg->text("Default SG: $defsg");
			$panelsg->text("Block model inside solid: $bmsg");
			$panelsg->text("");
			$panelsg->text("Press OK to reset Default SG to $bmsg");
			$panelsg->text("Press Cancel to keep as $defsg");
			
			if ($panelsg->execute("Change Default SG?")) { 
				$defsg = $bmsg;	
			}
		}
		 
	} else {
      	Lava::Error "\n ERROR opening DMP file $dmpfile \n";
    }
	
	return $bmbcm,$bmtonnes;
}

sub loadDefaults {
# ----------------
# get previous defaults
    dbmopen %DEFAULTS , "dandb_exportdefaults", 0666 ;
    $bmffile          	= $DEFAULTS{'bmffile'};
    $bmfpath          	= $DEFAULTS{'bmfpath'} || '.';
    $stratpath          = $DEFAULTS{'stratpath'} || 'V:\Master_Area\All_Sites\XACT\Resources';
	$tripath          	= $DEFAULTS{'tripath'} || '.';
	#Lava::Report "loaddefs paths bmfpath $bmfpath tripath $tripath"; 
	$csvpath         	= $DEFAULTS{'csvpath'} || '.'; # leave this as csvpath for compatibility
	$fmscsvpath         = $DEFAULTS{'fmscsvpath'} || '.';
	$surveycsvpath      = $DEFAULTS{'surveycsvpath'} || '.';
	$abdtcsvpath        = $DEFAULTS{'abdtcsvpath'} || '.';
	$bhcsvpath          = $DEFAULTS{'bhcsvpath'} || '.';
    $stratnumcsv      	= $DEFAULTS{'stratnumcsv'};
    $sethardness      	= $DEFAULTS{'sethardness'};
    $flagbmf      		= $DEFAULTS{'flagbmf'};
    $fmsout      		= $DEFAULTS{'fmsout'};
    $surveyout      	= $DEFAULTS{'surveyout'};
	$bhout      		= $DEFAULTS{'bhout'};
    $deforebody      	= $DEFAULTS{'deforebody'};
    $defpit      		= $DEFAULTS{'defpit'};
    $defpushback      	= $DEFAULTS{'defpushback'};
    $defblasttype      	= $DEFAULTS{'defblasttype'};  
    $setbmfvolume      	= $DEFAULTS{'setbmfvolume'}; 
    $solidtri      	    = $DEFAULTS{'solidtri'}; 
    $makesolid			= $DEFAULTS{'makesolid'};
    $spanlimitfactor	= $DEFAULTS{'spanlimitfactor'};
    $ignoresubdrill		= $DEFAULTS{'ignoresubdrill'} || 0;
    $typedesign      	 = $DEFAULTS{'typedesign'};
	$holetypefromfeature = $DEFAULTS{'holetypefromfeature'};
	$pushbackinname     = $DEFAULTS{'pushbackinname'};
    $blastdigits        = $DEFAULTS{'blastdigits'} || 4;
    $defhardness        = $DEFAULTS{'defhardness'} || 2;
    $defsg		        = $DEFAULTS{'defsg'};
    $jmbformat			= $DEFAULTS{'jmbformat'};
    $abdtout			= $DEFAULTS{'abdtout'};
    $fencedist			= $DEFAULTS{'fencedist'};
    $ABDT				= $DEFAULTS{'ABDT'};
    $internalfences		= $DEFAULTS{'internalfences'};
    $blastlogic         = $DEFAULTS{'blastlogic'};
    $patternguidregister = $DEFAULTS{'patternguidregister'} || $defpatternguidregister;
    $useregistryforguid = $DEFAULTS{'useregistryforguid'};
    $mq2_mine_site      = $DEFAULTS{'mq2_mine_site'};
    
    &buildpitsiteorebodylists;
}     


sub saveDefaults {
# ----------------
# save default values for next time

	$DEFAULTS{'deforebody'}     = $deforebody;
	$DEFAULTS{'defpit'}    		= $defpit;
	$DEFAULTS{'defpushback'}    = $defpushback;
	$DEFAULTS{'defblasttype'}   = $defblasttype;
	$DEFAULTS{'bmffile'}        = $bmffile;
	$DEFAULTS{'stratpath'}      = $stratpath;
	$DEFAULTS{'bmfpath'}        = $bmfpath;
	$DEFAULTS{'tripath'}        = $tripath;
	#Lava::Report "savedefs paths bmfpath $bmfpath tripath $tripath"; 
	$DEFAULTS{'csvpath'}        = $csvpath; # leave this as csvpath for compatibility
	$DEFAULTS{'fmscsvpath'}     = $fmscsvpath;
	$DEFAULTS{'bhcsvpath'}      = $bhcsvpath;
	$DEFAULTS{'surveycsvpath'}  = $surveycsvpath;
	$DEFAULTS{'abdtcsvpath'}    = $abdtcsvpath;
	$DEFAULTS{'stratnumcsv'}    = $stratnumcsv;
	$DEFAULTS{'sethardness'}    = $sethardness;
	$DEFAULTS{'flagbmf'}        = $flagbmf;
	$DEFAULTS{'fmsout'}         = $fmsout;
	$DEFAULTS{'surveyout'}      = $surveyout;
	$DEFAULTS{'bhout'}          = $bhout;
	$DEFAULTS{'setbmfvolume'}   = $setbmfvolume;
	$DEFAULTS{'solidtri'}   	= $solidtri;
	$DEFAULTS{'makesolid'}   	= $makesolid;
	$DEFAULTS{'spanlimitfactor'}   	= $spanlimitfactor;
	$DEFAULTS{'ignoresubdrill'}   	= $ignoresubdrill;
	$DEFAULTS{'typedesign'}   	= $typedesign;
	$DEFAULTS{'holetypefromfeature'}   = $holetypefromfeature;
	$DEFAULTS{'pushbackinname'}   = $pushbackinname;
	$DEFAULTS{'blastdigits'}   = $blastdigits;
	$DEFAULTS{'defhardness'}   = $defhardness;
	$DEFAULTS{'defsg'}   		= $defsg;
	$DEFAULTS{'jmbformat'}   	= $jmbformat;
	$DEFAULTS{'abdtout'}   		= $abdtout;
	$DEFAULTS{'fencedist'}   	= $fencedist;
	$DEFAULTS{'ABDT'}   		= $ABDT;
	$DEFAULTS{'internalfences'} = $internalfences;
	$DEFAULTS{'blastlogic'}     = $blastlogic;
	$DEFAULTS{'patternguidregister'} = $patternguidregister;
	$DEFAULTS{'useregistryforguid'} = $useregistryforguid;
	$DEFAULTS{'mq2_mine_site'}      = $mq2_mine_site; 
	
    dbmclose %DEFAULTS ;
}

sub dbswritecsv {
# ------------------------------------------------
# write dbs data to csv file and return hole count
#
	my ($blastname) = @_;
	
	my ($bhcount,$osolidtri,$obmffile,$lineout,$comma,$value,$colhardness);
	
	$colhardness = $headerpos{"HARDNESS"};
	$colsg = $headerpos{"SG"};
	
	if ($pushbackinname) 
	{
		$dbsoutfile = sprintf("%s-%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$pushback,$benchrl,$blast) . "-dbs-${surveytype}.csv"; 
	} else {
		$dbsoutfile = sprintf("%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$benchrl,$blast) . "-dbs-${surveytype}.csv";
	}
	
	unlink($dbsoutfile) if (-e "$dbsoutfile");
	if (open(CSV,">${csvpath}\\$dbsoutfile"))
	{
		$osolidtri = "";
		if ($makesolid)
		{
			$osolidtri = join(',',@solidlist);
		} else {
			$osolidtri = $solidtri;
		}

		$obmffile  = $bmffile  if($flagbmf or $bcm);
		
		# default to Solids volume or D&B volume if block model not used
		Lava::Report("\nVolumes Blockmodel:$bcm Solid:$solidsvol DBS Report:$dandbvolume");
		my $source_bcm = "UNKNOWN";
		if (1*$bcm == 0)
		{
			$bcm = $solidsvol;
			$source_bcm = "SOLID";
		} else {
			$source_bcm = "BMF";
		}
		
		if (1*$bcm == 0)
		{	
			$bcm = $dandbvolume;
			$source_bcm = "DBS_REPORT";	
		}
		$tonnes = sprintf("%.1f",$bcm * $defsg) if (1*$tonnes == 0);
		$bcm    = sprintf("%.1f",$bcm);	
		
		my $headerline =  "PATTERN NAME,$blastname\n" .
						  "BMF,$obmffile\n" .
						  "SOLID,$osolidtri\n" .
						  "DESIGN_BCM,$bcm\n" .
						  "DESIGN_TONNES,$tonnes\n" .
						  "BCM_FROM,$source_bcm\n" .
  						  "BLASTTYPE,$oblasttype\n";

		
		Lava::Report("\nHEADER:\n$headerline\n"); 
		
		$comma = "";		  
		for my $i (0..$#csvheaderlist)
		{
			if ($output2csv[$i])
			{
				$headerline .= "${comma}$csvheaderlist[$i]";
				$comma = ",";
			}
		}		  
				  
		print CSV "$headerline\n";
		
		for my $key (sort keys %holedata)
		{
			$comma = "";
			$lineout = "";
			my $depthcol = $headerpos{"DEPTH"};
			
			for my $i (0..$#{@holedata{$key}})
			{
				$value = $holedata{$key}[$i];
				$value = $defhardness if ($i == $colhardness and $value <= 0);
				$value = $defsg if ($i == $colsg and $value <= 0);
				
				if ($output2csv[$i])
				{
					$value    = " " if (!length($value));
					$value    = dps($value,1) if ($i == $depthcol); # round depth back ot 1dp for output
					$lineout .= "${comma}$value";

					$comma = ",";
				}
			}
			$bhcount++;
			#Lava::Report("cols $#{@holedata{$key}} $lineout");
			print CSV "$lineout\n";
		}
		
		close CSV;
		
	} else {
		Lava::Error(" Unable to open ${csvpath}\\$dbsoutfile for output. Is it open in Excel?");
	}	
	return $bhcount;
}


sub blastlogicwritecsv {
# ------------------------------------------------
# write blastlogic data to csv file and return hole count
#
	my ($blastname) = @_;
	
	my ($bhcount,$osolidtri,$obmffile,$lineout,$comma,$value,$colhardness);
	
	$colhardness = $headerpos{"HARDNESS"};
	$colsg = $headerpos{"SG"};
	
	if ($pushbackinname) 
	{
		$dbsoutfile = sprintf("%s-%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$pushback,$benchrl,$blast) . ".csv"; 
	} else {
		$dbsoutfile = sprintf("%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$benchrl,$blast) . ".csv";
	}
	
	unlink($dbsoutfile) if (-e "$dbsoutfile");
	if (open(CSV,">${csvpath}\\$dbsoutfile"))
	{
		$osolidtri = "";
		if ($makesolid)
		{
			$osolidtri = join(',',@solidlist);
		} else {
			$osolidtri = $solidtri;
		}

		$obmffile  = $bmffile  if($flagbmf or $bcm);
		
		# default to Solids volume or D&B volume if block model not used
		Lava::Report("\nVolumes Blockmodel:$bcm Solid:$solidsvol DBS Report:$dandbvolume");
		my $source_bcm = "UNKNOWN";
		if (1*$bcm == 0)
		{
			$bcm = $solidsvol;
			$source_bcm = "SOLID";
		} else {
			$source_bcm = "BMF";
		}
		
		if (1*$bcm == 0)
		{	
			$bcm = $dandbvolume;
			$source_bcm = "DBS_REPORT";	
		}
		$tonnes = sprintf("%.1f",$bcm * $defsg) if (1*$tonnes == 0);
		$bcm    = sprintf("%.1f",$bcm);	
		
		my $headerline =  "BLAST NAME,BLAST TYPE,PATTERN_GUID,PATTERN_VER,BLAST VOL,BLAST TONNAGE,SOLID,BMF";
		for my $i (0..$#csvheaderlist)
		{
			if ($output2csv[$i])
			{
				$headerline .= ",${comma}$csvheaderlist[$i]";
			}
		}		  
				  
		print CSV "$headerline\n";
		
		for my $key (sort keys %holedata)
		{
			$lineout = "$blastname,$oblasttype,$pattern_guid,$pattern_ver,$bcm,$tonnes,$osolidtri,$obmffile";
			my $depthcol = $headerpos{"DEPTH"};
			
			for my $i (0..$#{@holedata{$key}})
			{
				$value = $holedata{$key}[$i];
				$value = $defhardness if ($i == $colhardness and $value <= 0);
				$value = $defsg if ($i == $colsg and $value <= 0);
				
				if ($output2csv[$i])
				{
					$value    = " " if (!length($value));
					$value    = dps($value,1) if ($i == $depthcol); # round depth back ot 1dp for output
					$lineout .= ",$value";
				}
			}
			$bhcount++;
			#Lava::Report("cols $#{@holedata{$key}} $lineout");
			print CSV "$lineout\n";
		}
		
		close CSV;
		
	} else {
		Lava::Error(" Unable to open ${csvpath}\\$dbsoutfile for output. Is it open in Excel?");
	}	
	return $bhcount;
}

sub openinexcel {
# -------------------------------------------------------
# report output files and open DBS file in Excel
# 
	my ($bhcount,$internalfencecount) = @_;
	my $slash;
	
	my $panelcsv = new Lava::Panel;
	$panelcsv->text("EXPORTED BLAST HOLES = $bhcount");
	
	if ($bmhashardnum and $sethardness)
	{
		$panelcsv->text("Blockmodel HARDNUM overwritten by STRATNUM HARDNESS");
		$panelcsv->text("  ");
	}
	$slash ="";$slash = '\\' if ($csvpath =~ /^\\/);
	$panelcsv->text("CSV PATH: ${slash}${csvpath}");
	$panelcsv->text("CSV FILE: $dbsoutfile");
	$panelcsv->text("  ");
	if ($fmsout)
	{
		$slash ="";$slash = '\\' if ($fmscsvpath =~ /^\\/);
		$panelcsv->text("FMS PATH: ${slash}${fmscsvpath}");
		$panelcsv->text("FMS FILE: $fmsoutfile");
		$panelcsv->text("FMS FILE: $fmsoutfileaqm");
		$panelcsv->text("  ");
	}
	if ($surveyout)
	{
		$slash ="";$slash = '\\' if ($surveycsvpath =~ /^\\/);
		$panelcsv->text("SETOUT PATH: ${slash}${surveycsvpath}");
		$panelcsv->text("SETOUT FILE: $surveyoutfile");
		$panelcsv->text("  ");
	}
	
	if ($abdtout)
	{
		$slash ="";$slash = '\\' if ($abdtcsvpath =~ /^\\/);
		$panelcsv->text("Surface Manager PATH: ${slash}${abdtcsvpath}");
		$panelcsv->text("Trimble Fence            FILE: $trimbleoutfile");
		if ($internalfencecount == 0)
		{
			$panelcsv->text("Surface Manager DP FILE: $abdtoutfile[0]");
			$panelcsv->text("Surface Manager GF FILE: $geofenceoutfile[0]");
		} else {
			for my $poly (1..($internalfencecount))
			{
				$panelcsv->text("Surface Manager DP FILE: $abdtoutfile[$poly]");
				$panelcsv->text("Surface Manager GF FILE: $geofenceoutfile[$poly]");
			}
		}
		$panelcsv->text("  ");
	}
	
	if ($bhout)
	{
		$slash ="";$slash = '\\' if ($bhcsvpath =~ /^\\/);
		$panelcsv->text("BH PATH: ${slash}${bhcsvpath}");
		if (1 or $surveytype eq "FINALCOLLAR")
		{
			$panelcsv->text("BH FILE: $bhoutfile");
			
		} else {
			$panelcsv->text("BH FILE: NOT AVAILABLE FOR DESIGN");
		}
		$panelcsv->text("  ");
	}
	$panelcsv->text("Click OK to View CSV File in Excel ");
	if ($panelcsv->execute('View CSV file in Excel')) {
		if (open(BAT,">_dandb.bat"))
		{
			print BAT "echo off\n";
			print BAT "\"${csvpath}\\${dbsoutfile}\"\n";
			print BAT "exit\n";
		}
		close BAT;
		system "start /B _dandb.bat";
		
	}
}

sub buildpitsiteorebodylists {
# -------------------------------------------------------------------	
# build lists of Blastholes pit and orebody	and MQ2 pit and mine site
#
	@bhorebodylist    = ();
	@bhpitlist        = ();
	@mq2pitlist       = ();
	@mq2sitelist      = ();
	%mq2pitbybhobpit  = ();
	%mq2minesitebypit = ();
	@mergedpitlist    = ();
	my $RS;
	
	# lookup Blastholes
	my $Connbh = Win32::OLE-> new('ADODB.Connection');
	$Connbh->Open($ConnStrBH);
	
	my $err = Win32::OLE::LastError();
	if (not $err eq "0") 
	{ 
		Lava::Report "Error: " . Win32::OLE::LastError() . "\n";
	} else 
	{
		$sql = "SELECT OREBODY,PIT,MQ2_PIT_CODE FROM BH_PITS WHERE ACTIVE = 'Y' ORDER BY OREBODY,PIT";	
		Lava::Report "$sql";
		if(! ($RS = $Connbh->Execute($sql)))
		{ 
			$message2 = "SQL failed: " . Win32::OLE->LastError(); 
		
		} else {
			while (! $RS->EOF) 
			{
				my $ob     = $RS->Fields(0)->value;
				my $pit    = $RS->Fields(1)->value;
				my $mq2pit = $RS->Fields(2)->value;
				
				push @bhorebodylist, $ob     if ($ob and  ! ($ob    ~~ @bhorebodylist));
				push @bhpitlist,     $pit    if ($pit and ! ($pit    ~~ @bhpitlist));
				push @mq2pitlist,    $mq2pit if ($mq2pit and ! ($mq2pit ~~ @mq2pitlist));
				$mq2pitbybhobpit{$ob}{$pit} = $mq2pit if ($mq2pit);
				#Lava::Report "mq2pitbybhobpit{$ob}{$pit} = $mq2pit";
 				
				$RS->MoveNext; 
			}
			$RS->Close;
		}
		Lava::Report "BH Orebody List: " . join(",",@bhorebodylist);
		Lava::Report "BH PitList: " . join(",",@bhpitlist);
		$Connbh->Close;
	}
	
	my $Conn = Win32::OLE-> new('ADODB.Connection');
	$Conn->Open($ConnStrMQ2);
	my $err = Win32::OLE::LastError();
	if (not $err eq "0") 
	{ 
		Lava::Report "Error: " . Win32::OLE::LastError() . "\n";
		$message = "MQ2 Pit list load FAILED";
	
	} else 
	{
		$sql = "SELECT DISTINCT PIT, MINE_SITE FROM MQ2.V_PIT WHERE (ACTIVE=1) ORDER BY PIT";	
		Lava::Report "$sql";
		if(! ($RS = $Conn->Execute($sql)))
		{ 
			$message2 = "SQL failed: " . Win32::OLE->LastError(); 
			Lava::Report($message2);
		
		} else {
			while (! $RS->EOF) 
			{
				my $mq2pit  = $RS->Fields(0)->value;
				my $mq2site = $RS->Fields(1)->value;
				push @mq2sitelist, $mq2site if ($mq2site and ! ($mq2site ~~ @mq2sitelist));
				push @mq2pitlist,  $mq2pit  if ($mq2pit  and ! ($mq2pit  ~~ @mq2pitlist));
				$mq2minesitebypit{$mq2pit} = $mq2site;
				$RS->MoveNext; 
			}
			$RS->Close;
		}
		$Conn->Close;
		@mq2sitelist = (sort @mq2sitelist);
		Lava::Report "MQ2 SiteList: " . join(",",@mq2sitelist);
		Lava::Report "MQ2 PitList: " . join(",",@mq2pitlist);
	}
	foreach my $p (sort (@bhpitlist,@mq2pitlist))
	{
		push @mergedpitlist, $p if (! ($p ~~ @mergedpitlist));
	}
}

sub validatemq2pitid {
# ----------------------------------------------
# validate the mq2_pit_id global 
#
	my ($orebody,$pit) = @_;
	
	$mq2_pit_id = $pit;
	Lava::Report "Setting MQ2 pit for $orebody,$pit = $mq2pitbybhobpit{$orebody}{$pit}";
	if (exists $mq2pitbybhobpit{$orebody}{$pit})
	{
		$mq2_pit_id = $mq2pitbybhobpit{$orebody}{$pit};
	}
	if (exists $mq2minesitebypit{$mq2_pit_id})
	{
		$mq2_mine_site = $mq2minesitebypit{$mq2_pit_id};
	}
		
	# prompt user for MQ2 PIT_ID	
	my $panelm = new Lava::Panel;
	$panelm->text("  ");
	
	if (! ($mq2_pit_id ~~ @mq2pitlist))
	{
		$panelm->text("NOT FOUND MQ2 PIT_ID: $mq2_pit_id");
	} else {
		$panelm->text("FOUND MQ2 MINE_SITE: $mq2_mine_site");
		$panelm->text("FOUND MQ2 PIT_ID:    $mq2_pit_id");
		
	}
	$panelm->text("  ");
	$panelm->item("Use MQ2 MINE_SITE",\$mq2_mine_site,6);
	$panelm->pick_list_data(@mq2sitelist);
	$panelm->text("  ");
	$panelm->item("Use MQ2 PIT_ID   ",\$mq2_pit_id,6);
	$panelm->pick_list_data(@mq2pitlist);
	
	
	if ($panelm->execute("Orebody: $orebody    Pit: $pit"))
	{
	
	} else {
		$mq2pit = "";
	}
}

sub oracle2sqlguid {
#----------------------------------------------------
# convert an oracle hex string to sql server type GUID
	my $oraguid = shift;
	($a1,$a2, 
	$b1,$b2, 
	$c1,$c2, 
	$d1,$d2, 
	$e1,$e2, 
	$f1,$f2, 
	$g1,$g2, 
	$h1,$h2, 
	$i1,$i2, 
	$j1,$j2, 
	$k1,$k2, 
	$l1,$l2, 
	$m1,$m2, 
	$n1,$n2, 
	$o1,$o2, 
	$p1,$p2)=split(/ */,$oraguid); 

	return"${d1}${d2}${c1}${c2}${b1}${b2}${a1}${a2}-${f1}${f2}${e1}${e2}-${h1}${h2}${g1}${g2}-${i1}${i2}${j1}${j2}-${k1}${k2}${l1}${l2}${m1}${m2}${n1}${n2}${o1}${o2}${p1}${p2}";
} 

sub fmswriteaqm {
# ----------------------------------------------
# write fms data to csv file
#
	my ($mq2_pit_id) = @_;

	my ($fmsbhcount,$lineout,$toex,$toey,$toez,$toeangle,$toeazimuth,$hole,
				$xc,$yc,$zc,$azim,$dip,$trace,$hdist,$vdist,$pattern,$instruction);
	
	if ($jmbformat)
	{	
		$fmsoutfileaqm = sprintf("%s_%04d_%04d",$mq2_pit_id,$benchrl,$blast) . '.aqm';
	} else {
		$fmsoutfileaqm = sprintf("%s-%04d-%04d",$mq2_pit_id,$benchrl,$blast) . "-${surveytype}.aqm";
	}
	
	unlink($fmsoutfileaqm) if (-e $fmsoutfileaqm);
	if (open(CSV,">${fmscsvpath}\\$fmsoutfileaqm"))
	{
		# print header
		#print CSV "PitPushbackBench,Pattern,Hole Number,Easting,Northing,Elevation,Angle,Azimuth,Instruction\n";
		
		for my $key (sort keys %holedata)
		{
			$fmsbhcount++;
			# TOE X,TOE Y,TOE Z,TOE ANGLE,TOE AZIMUTH,INSTRUCTION 
			# COLLAR X,COLLAR Y,COLLAR Z,BEARING,ANGLE,DEPTH,SUBDRILL
			$hole  = $holedata{"$key"}[$headerpos{"HOLE ID"}] ;
			$xc    = $holedata{"$key"}[$headerpos{"COLLAR X"}] ;
			$yc    = $holedata{"$key"}[$headerpos{"COLLAR Y"}];
			$zc    = $holedata{"$key"}[$headerpos{"COLLAR Z"}];
			$azim  = $holedata{"$key"}[$headerpos{"BEARING"}];
			$dip   = $holedata{"$key"}[$headerpos{"ANGLE"}];    # assumes report from vertical
			$trace = $holedata{"$key"}[$headerpos{"DEPTH"}];
			$pattern = $holedata{"$key"}[$headerpos{"BLAST NAME"}];
			 
			$hdist = $trace * sin( $dip * $PI /180);
			$vdist = $trace * cos( $dip * $PI /180);
			$toex = dps($xc + $hdist * sin( $azim * $PI /180),3);
			$toey = dps($yc + $hdist * cos( $azim * $PI /180),3);
			$toez = dps($zc - $vdist,3);
			$toeangle = dps($dip,2);
			$toeazimuth = dps(($azim + 180) % 360,2);
			
			if (exists $holeinstructions{"${pattern}_$key"})
			{
				$instruction = $holeinstructions{"${pattern}_$key"};
			} else {
				$instruction = "";	
			}
			if ($jmbformat)
			# for JMB use last 2 characters of pit for column 1 in FMS file
			{
				my $temp = substr($mq2_pit_id,-2,2);
				print CSV sprintf("%s%04d%04d,%d,",$temp,$benchrl,$blast,$hole) .
								"$toex,$toey,$toez,$toeangle,$toeazimuth,$instruction\n";
			} else {					
				print CSV sprintf("%s_%04d,%04d,%d,",$mq2_pit_id,$benchrl,$blast,$hole) .
								"$toex,$toey,$toez,$toeangle,$toeazimuth,$instruction\n";
			}
		}
		
		close CSV;
		
	} else {
		Lava::Error(" Unable to open ${fmscsvpath}\\$fmsoutfileaqm for output. Is it open in Excel?");
	}	
	return $fmsbhcount;
}


sub fmswritecsv {
# ----------------------------------------------
# write fms data to csv file
#
	my ($mq2_pit_id) = @_;

	my ($fmsbhcount,$lineout,$toex,$toey,$toez,$toeangle,$toeazimuth,$hole,
				$xc,$yc,$zc,$azim,$dip,$trace,$hdist,$vdist,$pattern,$instruction);
	
	$fmsoutfile = sprintf("%s_%s_%04d_%04d",$mq2_mine_site,$mq2_pit_id,$benchrl,$blast) . ".csv";
	
	unlink($fmsoutfile) if (-e $fmsoutfile);
	if (open(CSV,">${fmscsvpath}\\$fmsoutfile"))
	{
		# print header
		#print CSV "PitPushbackBench,Pattern,Hole Number,Easting,Northing,Elevation,Angle,Azimuth,Instruction\n";
		
		for my $key (sort keys %holedata)
		{
			$fmsbhcount++;
			# TOE X,TOE Y,TOE Z,TOE ANGLE,TOE AZIMUTH,INSTRUCTION 
			# COLLAR X,COLLAR Y,COLLAR Z,BEARING,ANGLE,DEPTH,SUBDRILL
			$hole  = $holedata{"$key"}[$headerpos{"HOLE ID"}] ;
			$xc    = $holedata{"$key"}[$headerpos{"COLLAR X"}] ;
			$yc    = $holedata{"$key"}[$headerpos{"COLLAR Y"}];
			$zc    = $holedata{"$key"}[$headerpos{"COLLAR Z"}];
			$azim  = $holedata{"$key"}[$headerpos{"BEARING"}];
			$dip   = $holedata{"$key"}[$headerpos{"ANGLE"}];    # assumes report from vertical
			$trace = $holedata{"$key"}[$headerpos{"DEPTH"}];
			$pattern = $holedata{"$key"}[$headerpos{"BLAST NAME"}];
			 
			$hdist = $trace * sin( $dip * $PI /180);
			$vdist = $trace * cos( $dip * $PI /180);
			$toex = dps($xc + $hdist * sin( $azim * $PI /180),3);
			$toey = dps($yc + $hdist * cos( $azim * $PI /180),3);
			$toez = dps($zc - $vdist,3);
			$toeangle = dps($dip,2);
			$toeazimuth = dps(($azim + 180) % 360,2);
			
			if (exists $holeinstructions{"${pattern}_$key"})
			{
				$instruction = $holeinstructions{"${pattern}_$key"};
			} else {
				$instruction = "";	
			}
			
			if ($jmbformat)
			{
				# for JMB use last 2 characters of pit for column 1 in FMS file
				my $temp = substr($mq2_pit_id,-2,2);
				print CSV sprintf("%s%04d%04d,%d,",$temp,$benchrl,$blast,$hole) .
								"$toex,$toey,$toez,$toeangle,$toeazimuth,$instruction\n";
			} else {
				print CSV sprintf("%s_%04d_%04d,%d,",$mq2_pit_id,$benchrl,$blast,$hole) .
								"$toex,$toey,$toez,$toeangle,$toeazimuth,$instruction\n";
			}
		}
		
		close CSV;
		
	} else {
		Lava::Error(" Unable to open ${fmscsvpath}\\$fmsoutfile for output. Is it open in Excel?");
	}	
	return $fmsbhcount;
}


sub surveywritecsv {
# ----------------------------------------------
# write bh data to csv file
#
	my ($pit) = @_;

	my ($surveybhcount,$lineout,$xc,$yc,$zc,$hole);
	my $surveydate = &format_time("yyyymmdd");
	
	$surveyoutfile = sprintf("%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$benchrl,$blast) . "-SETOUT-${surveydate}.csv";
	
	unlink($surveyoutfile) if (-e $surveyoutfile);
	if (open(CSV,">${surveycsvpath}\\$surveyoutfile"))
	{
		# do not print header
		#print CSV "HOLE ID,COLLAR X,COLLAR Y,COLLAR Z\n";
		
		for my $key (sort keys %holedata)
		{
			$surveybhcount++;
			$hole  = $holedata{"$key"}[$headerpos{"HOLE ID"}] ;
			$xc    = $holedata{"$key"}[$headerpos{"COLLAR X"}] ;
			$yc    = $holedata{"$key"}[$headerpos{"COLLAR Y"}];
			$zc    = $holedata{"$key"}[$headerpos{"COLLAR Z"}];
			
			print CSV "$hole,$xc,$yc,$zc\n";
			
		}
		
		close CSV;
		
	} else {
		Lava::Error(" Unable to open ${surveycsvpath}\\$surveyoutfile for output. Is it open in Excel?");
	}	
	return $surveybhcount;
}

sub geofencewritetrimblecsv {
# ----------------------------------------------
# write fench data to trimble csv file
#
	my ($pit) = @_;

	my ($trimblecount,$x,$y,$xp,$yp);
	my $poly = 0;
	
	my $blastname = sprintf("%s%0${blastdigits}d%0${blastdigits}d",$pit,$benchrl,$blast);
	$trimbleoutfile = sprintf("%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$benchrl,$blast) . "_TR.csv";
	
	unlink($trimbleoutfile) if (-e $trimbleoutfile);
	if (open(CSV,">${abdtcsvpath}\\$trimbleoutfile"))
	{
		# do not print header
		#print CSV "Pattern,Point,Easting,Northing,RL\n";
		# don't write out last point if same as first
		my $x1 = sprintf("%.3f",$VertexList[$poly][0][0]);
		my $y1 = sprintf("%.3f",$VertexList[$poly][0][1]);	
		$Boundverts = scalar @{$VertexList[$poly]};
		#Lava::Report " Poly:$poly Boundverts = $Boundverts";	
		for ( $j = 0; $j < $Boundverts;$j++) 
		{
			$x = sprintf("%.3f",$VertexList[$poly][$j][0]);
			$y = sprintf("%.3f",$VertexList[$poly][$j][1]);
				
			if (($x == $xp and $y == $yp) or (($j == $Boundverts -1) and $x == $x1 and $y == $y1))
			{
				Lava::Report "Duplicate point ignored. Point: " . ($j +1) . " ($y,$x)";	
			} else {		
	      		$trimblecount++;
				print CSV "$blastname,$trimblecount,$x,$y,$benchrl\n";
				$xp = $x;
				$yp = $y;			
			}
		}
		close CSV;
		
	} else {
		Lava::Error(" Unable to open ${abdtcsvpath}\\$trimbleoutfile for output. Is it open in Excel?");
	}	
	return $trimblecount;
}

sub geofencewritetrimbledxf {
# ----------------------------------------------
# write fench data to trimble csv file
#
	my ($pit) = @_;

	my ($trimblecount,$x,$y,$z,$xp,$yp);
	my $poly = 0;
	my $templayer = "_TRIMBLEDXF";
	my $blastname = sprintf("%s%0${blastdigits}d%0${blastdigits}d",$pit,$benchrl,$blast);
	$trimbleoutfile = sprintf("%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$benchrl,$blast) . "_TR.dxf";
	
	unlink($trimbleoutfile) if (-e $trimbleoutfile);
	
	my $layer = new Lava::Layer "_TRIMBLEDXF", "Temporary layer to store trimble fence for output as dxf","clear";
	RunMenu("DESIGN_OBJ_DELETE","abort",
      sub { SelectObjects("$templayer","*","*","*"); },
      "SELECT_CANCEL",
      "FINISH") || print "Macro mismatch.\n";	
	
	$obj = new Lava::Obj;                                                        
	$obj->name($blastname);
	$obj->colour($fencecolour);
	$obj->line($fencelinetype);
	                                                           
	$obj->description("Trimble fence Created by $prog");                                                  
                                                            
    my $oc = $obj->coordinates;                                                  
   	                                                                                
	my $x1 = sprintf("%.3f",$VertexList[$poly][0][0]);
	my $y1 = sprintf("%.3f",$VertexList[$poly][0][1]);	
	$Boundverts = scalar @{$VertexList[$poly]};
	
	my $comp = 0; 	
	for ( $j = 0; $j < $Boundverts;$j++) 
	{
		$x = sprintf("%.3f",$VertexList[$poly][$j][0]);
		$y = sprintf("%.3f",$VertexList[$poly][$j][1]);
		$z = sprintf("%.3f",$VertexList[$poly][$j][2]);	
		if (($x == $xp and $y == $yp) or (($j == $Boundverts -1) and $x == $x1 and $y == $y1))
		{
			Lava::Report "Duplicate point ignored. Point: " . ($j +1) . " ($y,$x)";	
		} else {		
	  		$trimblecount++;
			$oc->i($oc->n, $x, $y, $z,0,$conp); 
			$conp = 1; 
			$xp = $x;
			$yp = $y;			
		}
	}
	$obj->closed(1); 
	$layer->add($obj);
	
	if ($trimblecount)
	{
		&export2dxf($abdtcsvpath,$trimbleoutfile,$templayer,$blastname,$blastname);
	
		RunMenu("DESIGN_OBJ_DELETE","abort",
	      sub { SelectObjects("$templayer","*","*","*"); },
	      "SELECT_CANCEL",
	      "FINISH") || print "Macro mismatch.\n";
	  }	
	return $trimblecount;
}

sub export2dxf {                                                                   
   my ($dxfpath,$dxffile,$layername,$objectname,$dxflayername) = @_;                                                  
                                                                                   
   my $dxffullfilename = "${dxfpath}/${dxffile}";
                                       
   unlink "$dxffullfilename" if (-f "$dxffullfilename");                                           
                                                                                   
   Lava::Show "Exporting $dxffullfilename";	                                               
                                                                                   
	RunMenu("FILES_IMPEXP_EXPORT","abort",                                         
      sub { PanelResults("export",                                                 
                "button_pressed" => "ok",                                          
                "datum0" =>                                                        
                   {                                                               
                   "selection2" =>                                                 
                      [                                                            
                         "0",                                                      
                         "4",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0"                                                       
                      ],                                                           
                   "value" =>                                                      
                      [                                                            
                         [ "ASCII" ] ,                                             
                         [ "AutoCAD (dwg,dxf,dxb)" ] ,                             
                         [ "CSV (Databases)" ] ,                                   
                         [ "Datamine" ] ,                                          
                         [ "Easimine" ] ,                                          
                         [ "Inventor" ] ,                                          
                         [ "Micromine" ] ,                                         
                         [ "Microstation" ] ,                                      
                         [ "Ngrain" ] ,                                            
                         [ "PDF" ] ,                                               
                         [ "Pitboss" ] ,                                           
                         [ "VRML" ] ,                                              
                         [ "Whittle 4X" ]                                          
                      ]                                                            
                   },                                                              
                "datum1" =>                                                        
                   {                                                               
                   "selection2" =>                                                 
                      [                                                            
                         "0",                                                      
                         "4",                                                      
                         "0",                                                      
                         "0"                                                       
                      ],                                                           
                   "value" =>                                                      
                      [                                                            
                         [ "Design Strings/Grids/Triangulations (dwg,dxf,dxb)" ] , 
                         [ "Design Strings/Grids/Triangulations (dxf)" ] ,         
                         [ "ICF Tables Setup" ] ,                                  
                         [ "Triangulations" ]                                      
                      ]                                                            
                   }                                                               
                   ); },                                                           
      sub { PanelResults("ExpDXFSelection",                                        
                "file_ext" => "dxf",                                               
                "file_type" => "AutoCAD (dxf)",                                    
                "button_pressed" => "ok",                                          
                "newFile" =>  "$dxffullfilename"                                           
                   ); },                                                           
      sub { PanelResults("ExpDXFOptions",                                          
                "button_pressed" => "ok",                                          
                "transfer_tab" =>                                                  
                   {                                                               
                   "dxfLayerName" => "$dxflayername",                                           
                   "promptForDxfLayer" => "0",                                     
                   "autocad" => "1",                                               
                   "arcView" => "0",                                               
                   "expColour" => "1",                                             
                   "dxfLayerNameFromDgd" => "0",                                   
                   "expUseICFColourTables" => "1",                                 
                   "specifyOneDxfLayer" => "1",                                    
                   "dxfLayerNameFromTable" => "0"                                  
                   },                                                              
                "load_tab" =>                                                      
                   {                                                               
                   "allow3dPolyWhenZVary" => "1",                                  
                   "reviewOrModify" => "0",                                        
                   "placeElevOn2dEnt" => "0",                                      
                   "applyVertExag" => "0",                                         
                   "tran3dInfoToDxf" => "checked",                                 
                   "vertExag" => "5.0",                                            
                   "decimalPlaces" => "3",                                         
                   "outputVerFormat" => "0"                                        
                   }                                                               
                   ); },                                                           
      sub { PanelResults("Select By",                                              
                "button_pressed" => "Design Data"                                  
                   ); },                                                           
      sub { SelectObjects("${layername}","$objectname","*","*"); },                         
      "SELECT_CANCEL",                                                             
      sub { PanelResults("Select By",                                              
                "button_pressed" => "cancel"                                       
                   ); },                                                           
                                                                                   
      sub { PanelResults("export",                                                 
                "button_pressed" => "cancel",                                      
                "datum0" =>                                                        
                   {                                                               
                   "selection2" =>                                                 
                      [                                                            
                         "0",                                                      
                         "4",                                                      
                       "0",                                                        
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0",                                                      
                         "0"                                                       
                      ],                                                           
                   "value" =>                                                      
                      [                                                            
                         [ "ASCII" ] ,                                             
                         [ "AutoCAD (dwg,dxf,dxb)" ] ,                             
                         [ "CSV (Databases)" ] ,                                   
                         [ "Datamine" ] ,                                          
                         [ "Easimine" ] ,                                          
                         [ "Inventor" ] ,                                          
                         [ "Micromine" ] ,                                         
                         [ "Microstation" ] ,                                      
                         [ "Ngrain" ] ,                                            
                        [ "PDF" ] ,                                                
                         [ "Pitboss" ] ,                                           
                         [ "VRML" ] ,                                              
                         [ "Whittle 4X" ]                                          
                      ]                                                            
                   },                                                              
                "datum1" =>                                                        
                   {                                                               
                   "selection2" =>                                                 
                      [                                                            
                         "0",                                                      
                         "4",                                                      
                         "0",                                                      
                         "0"                                                       
                      ],                                                           
                   "value" =>                                                      
                      [                                                            
                         [ "Design Strings/Grids/Triangulations (dwg,dxf,dxb)" ] , 
                         [ "Design Strings/Grids/Triangulations (dxf)" ] ,         
                         [ "ICF Tables Setup" ] ,                                  
                         [ "Triangulations" ]                                      
                      ]                                                            
                   }                                                               
                   ); },                                                           
      "FINISH");
      
  rename lc($dxffullfilename), $dxffullfilename;	                                                               
  Lava::Report "Exported $dxffullfilename";                                                
}	  

sub geofencewritecsv {
# ----------------------------------------------
# write bh data to csv file
#
	my ($pit,$poly,$seqtext) = @_;

	my ($geofencecount,$x,$y,$xp,$yp);
	my $geofencedate = &format_time("yyyymmdd");
	
	$geofenceoutfile[$poly] = sprintf("%s-%0${blastdigits}d-%0${blastdigits}d%s",$pit,$benchrl,$blast,$seqtext) . "_${geofencedate}_GF.geofence";
	
	unlink($geofenceoutfile[$poly]) if (-e $geofenceoutfile[$poly]);
	if (open(CSV,">${abdtcsvpath}\\$geofenceoutfile[$poly]"))
	{
		# do not print header
		print CSV "y,x\n";
		# don't write out last point if same as first
		my $x1 = sprintf("%.3f",$VertexList[$poly][0][0]);
		my $y1 = sprintf("%.3f",$VertexList[$poly][0][1]);	
		$Boundverts = scalar @{$VertexList[$poly]};
		#Lava::Report " Poly:$poly Boundverts = $Boundverts";	
		for ( $j = 0; $j < $Boundverts;$j++) 
		{
			$x = sprintf("%.3f",$VertexList[$poly][$j][0]);
			$y = sprintf("%.3f",$VertexList[$poly][$j][1]);
				
			if (($x == $xp and $y == $yp) or (($j == $Boundverts -1) and $x == $x1 and $y == $y1))
			{
				Lava::Report "Duplicate point ignored. Point: " . ($j +1) . " ($y,$x)";	
			} else {		
	      		$geofencecount++;
				print CSV "$y,$x\n";
				$xp = $x;
				$yp = $y;			
			}
		}
		close CSV;
		
	} else {
		Lava::Error(" Unable to open ${abdtcsvpath}\\$geofenceoutfile[$poly] for output. Is it open in Excel?");
	}	
	return $geofencecount;
}


sub abdtwritecsv {
# ----------------------------------------------
# write bh data to csv file
#
	my ($pit,$poly,$seqtext) = @_;

	my ($abdtbhcount,$lineout,$xc,$yc,$zc,$xt,$yt,$zt,$azim,$dip,$trace,$hole,$holecount,$hdist,$vdist);
	my $abdtdate = &format_time("yyyymmdd");
	
	$abdtoutfile[$poly] = sprintf("%s-%0${blastdigits}d-%0${blastdigits}d%s",$pit,$benchrl,$blast,$seqtext) . "_${abdtdate}_DP.csv";
	
	unlink($abdtoutfile[$poly]) if (-e $abdtoutfile[$poly]);
	if (open(CSV,">${abdtcsvpath}\\$abdtoutfile[$poly]"))
	{
		#print header
		print CSV "Pattern Name,Hole ID,Collar X/Northing ,Collar Y/Easting,Collar Z,Toe X/Northing,Toe Y/Easting,Toe Z\n";
		
		$abdtbhcount = 0;
		for my $key (sort keys %holedata)
		{
			$holecount++;
			$hole  = $holedata{"$key"}[$headerpos{"HOLE ID"}] ;
			$xc    = sprintf("%.3f",$holedata{"$key"}[$headerpos{"COLLAR X"}]);
			$yc    = sprintf("%.3f",$holedata{"$key"}[$headerpos{"COLLAR Y"}]);
			$zc    = sprintf("%.3f",$holedata{"$key"}[$headerpos{"COLLAR Z"}]);
			
			if (&pointinpolygon($xc,$yc,\@{$VertexList[$poly]}))
			{
				$azim  = $holedata{"$key"}[$headerpos{"BEARING"}];
				$dip   = $holedata{"$key"}[$headerpos{"ANGLE"}];
				$trace = $holedata{"$key"}[$headerpos{"DEPTH"}];

				$hdist = $trace * sin( $dip * $PI /180);
				$vdist = $trace * cos( $dip * $PI /180);
				$xt = sprintf("%.3f",$xc + $hdist * sin( $azim * $PI /180));
				$yt = sprintf("%.3f",$yc + $hdist * cos( $azim * $PI /180));
				$zt = sprintf("%.3f",$zc - $vdist);
				
				$abdtbhcount++;
				print CSV sprintf("%s-%0${blastdigits}d-%0${blastdigits}d",$pit,$benchrl,$blast) . 
								",$hole,$yc,$xc,$zc,$yt,$xt,$zt\n";
			}	
		}
		
		close CSV;
		
		Lava::Report(" Written $abdtbhcount from $holecount holes inside Geo Fence $poly");
	} else {
		Lava::Error(" Unable to open ${abdtcsvpath}\\$abdtoutfile[$poly] for output. Is it open in Excel?");
	}	
	return $abdtbhcount;
}




sub bhwritecsv {
# ----------------------------------------------
# write bh data to csv file
#
	my ($mq2_pit_id) = @_;

	my ($bhbhcount,$lineout,$comma,$angle,$azim,$xc,$yc,$zc,$dip,$holelength,$hole,
		$subdrill,$diameter,$burden,$spacing,$sg,$hardness,$stratnum);
	
	$bhoutfile = sprintf("%s-%s-%04d-%04d",$mq2_mine_site,$mq2_pit_id,$benchrl,$blast) . "-${surveytype}.csv";
	
	unlink($bhoutfile) if (-e $bhoutfile);
	if (open(CSV,">${bhcsvpath}\\$bhoutfile"))
	{
		# print header
		print CSV "HOLE_ID,COLLAR_X,COLLAR_Y,COLLAR_Z,BEARING,ANGLE,DEPTH,SUBDRILL,DIAMETER,BURDEN,SPACING,SG,HARDNESS,STRATNUM,PATTERN_GUID,PATTERN_VER\n";
		
		for my $key (sort keys %holedata)
		{
			$bhbhcount++;
			$hole  = $holedata{"$key"}[$headerpos{"HOLE ID"}] ;
			$xc    = $holedata{"$key"}[$headerpos{"COLLAR X"}] ;
			$yc    = $holedata{"$key"}[$headerpos{"COLLAR Y"}];
			$zc    = $holedata{"$key"}[$headerpos{"COLLAR Z"}];
			$azim  = $holedata{"$key"}[$headerpos{"BEARING"}];
			$dip   = $holedata{"$key"}[$headerpos{"ANGLE"}];    # assumes report from vertical
			$dip = -1*(90- $dip);								# from horizontal negative down 
			
			$holelength = dps($holedata{"$key"}[$headerpos{"DEPTH"}],1);
			$subdrill	= $holedata{"$key"}[$headerpos{"SUBDRILL"}];
			$diameter	= $holedata{"$key"}[$headerpos{"DIAMETER"}];
			$burden		= $holedata{"$key"}[$headerpos{"BURDEN"}];
			$spacing	= $holedata{"$key"}[$headerpos{"SPACING"}];
			$sg			= $holedata{"$key"}[$headerpos{"SG"}];
			$hardness	= $holedata{"$key"}[$headerpos{"HARDNESS"}];
			$stratnum	= $holedata{"$key"}[$headerpos{"STRATNUM"}];
			
			print CSV "$hole,$xc,$yc,$zc,$azim,$dip,$holelength,$subdrill,$diameter,$burden,$spacing,$sg,$hardness,$stratnum,$pattern_guid,$pattern_ver\n";
			
		}
		
		close CSV;
		
	} else {
		Lava::Error(" Unable to open ${bhcsvpath}\\$bhoutfile for output. Is it open in Excel?");
	}	
	return $bhbhcount;
}


sub getcodes {
# --------------------------------------------------------------------------
# get data codes from Object Name or Description
# --------------------------------------------------------------------------
	my ($object) = @_;
	
       # set default values
      my $orebody      = $deforebody;
      my $pit          = $defpit;
      my $pushback     = $defpushback;
      my $blasttype    = $defblasttype;
      my $benchheight  = $defbenchheight;
      my $blockheight  = $defblockheight;
      my $blocktoe     = $defblocktoe;
      my $blockname    = '';
      my $name         = uc($$object->name);
      my $group        = $$object->group;
      # make sure the default period is set if group is blank
      
      my $description  = $$object->description;
      my $format = "";
	  my($benchrl,$xp,$yp,$rlfirstpoint,$wp,$conp,$namep);

      # set blast to zero so we can check if it gets set
      my $blast = 0;

      # get the first point for default Rl 
      my $coords = $$object->coordinates;
      my $points = $coords->n;
      if ($points) {($xp,$yp,$rlfirstpoint,$wp,$conp,$namep) = $coords->i(0); }

      # check for Object name for defaults in case description is not yet set
      # could be Picky BLOCK Format
      if ( $name =~ /(\d{3})(\d{1})(\d{3})_(.+)/ ) {
            $blocktoe  = $1;
            $blasttype = $2;
            $blast     = $3;
            $blockname = $4;

      } elsif ($name =~ /(\w{1,3})(\d{3})(\D{1})(\d{1,4})/) {
            $format = "PERIOD";
            $pushback = $pit = $1;
            $blasttype = $3;
            $blast     = $4;

      # look for iScheduler format eg p1r12rl487
      } elsif ($name =~ /(\w{1,2})R(\d+)RL(\d{1,3})/) {
            $pushback = $pit = $1;
            $blocktoe  = $3;
            $blast     = $2;

      # else no usefull name just get blocktoe from first point RL
      } elsif ($points) {
            # get block Toe RL from first point
            $blocktoe  = $rlfirstpoint;
      }


      # check if this is a Bench Blast Plan format with all codes space separated in the Object Decription
      # --------------------------------------------------------------------------------------------------
      if (substr($description,0,6) eq "BLAST_") {
            $format = "BLAST";
            ($tritype,$orebody,$pit,$pushback,$blocktoe,$blasttype,$blast,$benchheight,$blockheight) = split '_', $description;
            $benchrl = $blocktoe;

      } elsif (substr($description,0,6) eq "BLOCK " || substr($description,0,9) eq "SUBBLOCK " || substr($description,0,6) eq "BHOLE ") {
            ($format,$temp,$benchrl,$benchheight) = split / /,$description;
            ($orebody,$pit,$pushback,$blocktoe,$temp2,$blockname) = split /\\/, $temp;		 
            $blasttype = substr($temp2,0,1);
            $blast     = substr($temp2,1);
            $blockheight = $$object->value;

      } elsif ($format eq "PERIOD") {
            # could be a PERIOD format from XPAC so see if we can split it into
            ($periodname, $temp) = split ' ', $description ;
            ($orebody,$pit,$pushback,$blocktoe,$temp2) = split /\\/, $temp;
            $blasttype = substr($temp2,0,1);
            $blast     = substr($temp2,1);
            $format = "" if (!$blast);
            $benchheight = $blockheight = $$object->value;
      }

      $blocktoe  = sprintf("%5.1f", $blocktoe);
      
      $blast = $defblast if (! $blast);

	# strip spaces out of blockname
	$blockname =~ s/ //g;
	
      # if block Toe RL has changed prompt to remove previous triangulations
      # --------------------------------------------------------------------
      if ($prevblocktoe > -9999 && $prevblocktoe != $blocktoe) {
            if ($triremove) { &removetriangulations; }
            $prevblast = 0;
            $prevblockname = "";

      } else {
            # increment blockname if same blast and block name not set
            if (($blast == $prevblast) && !$blockname && $prevblockname ) {
                  $prevblockname =~ /(\D*)(\d+)/;
                  $temp = $2 + 1;
                  $blockname = "$1" . "$temp";
	      }
      }

      # add leading zeros and clip length on variables
      $blast = sprintf("%04d","$blast");
      
	$blasttype = "0" if (!$blasttype);
	
      $prevblast = $blast;
      $prevblockname = $blockname;
      $benchrl = $blocktoe if (! $benchrl); 
      
     	return $format,$orebody,$pit,$pushback,$benchrl,$blocktoe,$blasttype,$blast,$blockname,$blockheight,$benchheight,$group,$rlfirstpoint,$prevblockname;
}


sub format_time {
#------------------------------------------------------------
#
# Returns the current time as dd-mth-yyyy
# easier with POSIX but not available in Vulcans perl
#
	my ($option) = @_;
	
	my($sec,$min,$hour,$mday,$mon,$year,$wday,$yday,$isdst) = localtime(time);
	my ($yyyy,$mm,$dd,$hh,$mn,$ss,$return);
	my @month = ("Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec");
	$yyyy = $year +1900;
	$yy   = substr($yyyy,2,2);
	$mm = substr(($mon + 101),1,2);
	$dd = substr(($mday + 100),1,2);
	$hh = substr(($hour + 100),1,2);
	$mn = substr(($min + 100),1,2);
	$ss = substr(($sec + 100),1,2);
	if ($option eq "datetime") 
	{
		$return = "${yyyy}-${mm}-${dd}-$hh-$mn";
	
	} elsif ($option eq "yyyymmdd") {
		$return = "${yyyy}${mm}${dd}";	
		
	} else {
		$return = "${dd}-$month[$mon]-${yy}";
	}
	return $return; 
}


sub runDBSreport {
#------------------------------------------------------------------------------------------
# run the report over selected blast
	
	my ($dandblayer,$blastname) = @_;
	my ($foundheader,$linein,$keyholeid, $holecount,@colnames,$csvcolholeid,$csvcolpattern,$pattern,$patternptr,%duplicatecount);
	
	Lava::Show("Running DBS Report");
			
	unlink("_dandbDBS.csv") if (-e "_dandbDBS.csv");
	
	@grlist = ();
	foreach $pattern (keys %blastids)
	{
		push @grlist,["$dandblayer","$pattern","1","$pattern"]; 
	} 
	
	RunMenu("OPENPIT_NBLAST_REPORTING","abort",
      sub { PanelResults("report_details",
                "rb_export_to_single" => "1",
                "csv_del" => ",",
                "fs_summary_report" => "",
                "columnar" => "0",
                "button_pressed" => "ok",
                "show_type" => "0",
                "rb_export_to_separate" => "0",
                "ch_summary_report" => "0",
                "eb_suffix" => "",
                "grid_refresher" => "0",
                "gr_multi_blast_list" => [@grlist],
                "report_name" => "DBS",
                "eb_prefix" => "",
                "csv" => "1",
                "show_report" => "0",
                "columnar_del" => "|",
                "show_errors" => "0",
                "filterbypoly" => "0",
                "save_file" => "_dandbDBS.csv"
                   ); },
      "FINISH") || Lava::Error "OPENPIT_NBLAST_REPORTING FAILED\n";
	

	if (-e "_dandbDBS.csv") 
	{
		# open the report file and load data into memory and write a map file
		# -------------------------------------------------------------------
		if (open REP,"<_dandbDBS.csv") 
		{
			$csvcolholeid = -1;
			$csvcolpattern = -1;
			my $colblastname = $headerpos{"BLAST NAME"} if (defined $headerpos{"BLAST NAME"});
			my $colhardness = $headerpos{"HARDNESS"} if (defined $headerpos{"HARDNESS"});
			my $colstratnum = $headerpos{"STRATNUM"} if (defined $headerpos{"STRATNUM"});
			my $colholetype = $headerpos{"HOLE TYPE"} if (defined $headerpos{"HOLE TYPE"});
			my $colsg = $headerpos{"SG"} if (defined $headerpos{"SG"});
			
			my ($prevpattern,$prevvolume);
			
			while (<REP>)
			{	
				chomp;
				if ($_ =~ /\s*(.+)\s*/)
				{
					$linein = $1;
					
					if (! $foundheader)
					{
						
						if ($linein =~ /^HOLE ID/)
						{
							@colnames = split(",",uc($linein));
							# set up mapping into memory
							for my $i (0..$#colnames)
							{
								if (exists ($headerpos{$colnames[$i]}))
								{	
									$DBScol[$i] = $headerpos{$colnames[$i]};
								}
								$csvcolholeid = $i if ($colnames[$i] eq "HOLE ID");
								$csvcolpattern = $i if ($colnames[$i] eq "BLAST NAME"); 
							}
							$foundheader = 1;
							if ($csvcolholeid < 0)
							{
								Lava::Error(" Column HOLE ID not found in report output _dandbDBS.csv");
								return 0;	
							}
							if ($csvcolpattern < 0)
							{
								Lava::Error(" Column BLAST NAME not found in report output _dandbDBS.csv");
								return 0;	
							}
						} elsif ($linein =~ /Overall Blast Volume .*: (\d+) cubic m/) 
							# Overall Blast Volume : 195657 cubic m
							# Overall Blast Volume (including subdrill and excluding standoff): 560663 cubic m
						{
							$prevvolume = $1;	
						}
					} elsif (length($linein)) {
						
						# load data
						my @rowvalues = split(",",$linein);
						
						if ($linein =~ /Overall Blast Volume .*: (\d+) cubic m/) 
						{
							$prevvolume = $1;	
						
						} elsif ($rowvalues[0] =~ /^\d+$/)
						# ignore header data
						{
							if ($rowvalues[$csvcolpattern] ne $prevpattern)
							{
								# a new vulcan blast so accumulate the previous volume
								$dandbvolume += $prevvolume;
								$prevvolume = 0;
								$prevpattern = $rowvalues[$csvcolpattern]; 
								$patternptr++;
							}
							
							$keyholeid = sprintf("%06d",$rowvalues[$csvcolholeid]);
							
							# check if we have duplicate holeids
							# ----------------------------------
							if (exists $holedata{"$keyholeid"})
							{
								$duplicatecount++;
								Lava::Report(" Duplicate hole $rowvalues[$csvcolholeid] in $prevpattern also in $holedata{$keyholeid}[$colblastname]");
								$temp = $keyholeid;
								$keyholeid = sprintf("%06d",$temp + 1000000 * $patternptr);
								
								# copy over any instruction to new key
								if (exists $holeinstructions{"${prevpattern}_$temp"}) {
									$holeinstructions{"${prevpattern}_$keyholeid"} = $holeinstructions{"${prevpattern}_$temp"}; } 
							}
						
							$holecount++; 
							#Lava::Report(" col $csvcolholeid Key: $keyholeid  @rowvalues"); 
							for my $i (0..$#colnames)
							{
								#Lava::Report("$keyholeid, $colnames[$i], $headerpos{$colnames[$i]} = $rowvalues[$i]");
								if ($DBScol[$i] > -1)
								{	
									if ($colnames[$i] eq "ANGLE")
									{	
										$holedata{"$keyholeid"}[$DBScol[$i]] = $rowvalues[$i];
										#$holedata{"$keyholeid"}[$DBScol[$i]] = -1 * abs($rowvalues[$i]);
									
									} else {	
										$holedata{"$keyholeid"}[$DBScol[$i]] = $rowvalues[$i];
									}
									#Lava::Report(" $keyholeid, $colnames[$i], $DBScol[$i] = $rowvalues[$i]");
								}
							}
							$holedata{"$keyholeid"}[$colhardness] = 0 if ($colhardness > -1);
							$holedata{"$keyholeid"}[$colstratnum] = 0 if ($colstratnum > -1);
							$holedata{"$keyholeid"}[$colsg] = 0 if ($colsg > -1);
						
							if ((! $holedata{"$keyholeid"}[$colholetype]) and $holetypefromfeature and defined($holefeatures{"${prevpattern}_$keyholeid"}))
							{
								$holedata{"$keyholeid"}[$colholetype] =$holefeatures{"${prevpattern}_$keyholeid"};
							}
						
						} else {
							#Lava::Report(" Skipping $rowvalues[0] line $linein");
						}    				
					}
				}
			}
			close REP;
			
			$dandbvolume = $prevvolume if (!$dandbvolume); # just in case it has not been set e.g. no blast name col
			
			Lava::Report(" Holes loaded from DBS Report: $holecount  Duplicates: $duplicatecount");
			Lava::Error(" $duplicatecount Duplicate Hole IDs found. Check Envisage Report Window.") if ($duplicatecount); 
				
		} else {
			Lava::Error(" Could not open report file _dandbDBS.csv");
		}
		
	} else {
		Lava::Error(" OPENPIT_NBLAST_REPORTING Failed");
	} 
	return $holecount;    
}


sub exporttomapfile {
#------------------------------------------------------
# export selected holes to temporary map file
#
	my ($mapfile,$bmmfile) = @_;

	my ($bhcount,$xmid,$ymid,$zmid,$xc,$yc,$zc); 
	
	unlink($mapfile) if (-e $mapfile);
	if (! open(MAPFILE, ">$mapfile"))			   
	{
		Lava::Error(" Unable to open mapfile: ${mapfile}. Could be write permissions or file is open in Excel?");
		return 0;	
	}

	
	print MAPFILE '*                                 ' . "\n";
	print MAPFILE '* DEFINITION                      ' . "\n";
	print MAPFILE '*   VARIABLES 4                   ' . "\n";
	print MAPFILE '*     DHID             C   6   0  ' . "\n";
	print MAPFILE '*     MIDX             F  15   4  ' . "\n";
	print MAPFILE '*     MIDY             F  15   4  ' . "\n";
	print MAPFILE '*     MIDZ             F  15   4  ' . "\n";  
	print MAPFILE '*                                 ' . "\n";
	print MAPFILE '*                                 ' . "\n";
	
	for my $keyholeid (sort keys %holedata)
	{
		#Lava::Report(" Hole data key $keyholeid");
		$bhcount++;
		
		my $xc    = $holedata{"$keyholeid"}[$headerpos{"COLLAR X"}]   if (defined($headerpos{"COLLAR X"}));
		my $yc    = $holedata{"$keyholeid"}[$headerpos{"COLLAR Y"}]   if (defined($headerpos{"COLLAR Y"}));
		my $zc    = $holedata{"$keyholeid"}[$headerpos{"COLLAR Z"}]   if (defined($headerpos{"COLLAR Z"}));
		my $azim  = $holedata{"$keyholeid"}[$headerpos{"BEARING"}]    if (defined($headerpos{"BEARING"}) );
		my $dip   = $holedata{"$keyholeid"}[$headerpos{"ANGLE"}]      if (defined($headerpos{"ANGLE"})   );    # assumes report from vertical
		my $trace = $holedata{"$keyholeid"}[$headerpos{"DEPTH"}]      if (defined($headerpos{"DEPTH"})   );
		
		my $hdist = $trace * sin( $dip * $PI /180);
		my $vdist = $trace * cos( $dip * $PI /180);
		# below for -90 down
		#my $hdist = $trace * cos(abs($dip) * $PI /180);
		#my $vdist = $trace * sin(abs($dip) * $PI /180);
		
		$xmid = $xc + $hdist * sin( $azim * $PI /180) /2;
		$ymid = $yc + $hdist * cos( $azim * $PI /180) /2;
		$zmid = $zc - $vdist/2;
			
		my $lineout = sprintf("%06d%15.4f%15.4f%15.4f",$keyholeid,$xmid,$ymid,$zmid);
		print MAPFILE "$lineout\n";

	}
	close MAPFILE;
	Lava::Report(" Blastholes exported to mapfile: $bhcount");
	
	return $bhcount;
}


sub insertDBSspec {
#-----------------------------------------------------------------------
# insert the DBS report spec into specifications.dab
#
# Lava::Report " Ignore subdrill here $ignoresubdrill"; 
my $dbsspec = <<EOS1;
   "DBS" = 
    { 
     "button_pressed" = "save_as",
     "my_tree" = "rep_prefs",
     "ovr_column_order" = 
      {
       "columns_grid" = 
        [
          [
            "Hole Name"
          ],
          [
            "Collar X"
          ],
          [
            "Collar Y"
          ],
          [
            "Collar Z"
          ],
          [
            "Bearing"
          ],
          [
            "Dip"
          ],
          [
            "Hole Length"
          ],
          [
            "Subdrill Length"
          ],
          [
            "Target Length"
          ],
          [
            "Hole Diameter"
          ],
          [
            "Burden"
          ],
          [
            "Spacing"
          ],
          [
            "Blast Name"
          ]
        ],
       "display_columns" = 1
      },
     "ovr_footer" = 
      {
       "blast_info_just" = "Left",
       "blast_name" = 0,
       "calc_drill_time" = 1,
       "calc_drill_time_dec" = "2",
       "calc_drill_time_title" = "Drilling Time",
       "drill_length_total" = 0,
       "drill_length_total_just" = "Left",
       "drill_number_total" = 0,
       "drill_number_total_just" = "Left",
       "drilling_info" = 0,
       "drilling_info_just" = "Left",
       "hole_diam" = 1,
       "hole_diam_dec" = "3",
       "hole_diam_title" = "Diameter",
       "ignore_subdrill" = $ignoresubdrill,
       "notes" = 0,
       "notes_1" = "",
       "notes_2" = "",
       "notes_3" = "",
       "notes_just" = "Left",
       "penetration_rate" = 1,
       "penetration_rate_dec" = "2",
       "penetration_rate_title" = "Pen. Rate",
       "sum_rock_type" = 0,
       "sum_rock_type_just" = "Left",
       "volume_just" = "Left",
       "volume_on" = 0
      },
     "ovr_header" = 
      {
       "blast_info_just" = "Left",
       "blast_name" = 0,
       "calc_drill_time" = 1,
       "calc_drill_time_dec" = "2",
       "calc_drill_time_title" = "Drilling Time",
       "drill_length_total" = 0,
       "drill_length_total_just" = "Left",
       "drill_number_total" = 0,
       "drill_number_total_just" = "Left",
       "drilling_info" = 0,
       "drilling_info_just" = "Left",
       "hole_diam" = 1,
       "hole_diam_dec" = "3",
       "hole_diam_title" = "Diameter",
       "ignore_subdrill" = $ignoresubdrill,
       "notes" = 0,
       "notes_1" = "",
       "notes_2" = "",
       "notes_3" = "",
       "notes_just" = "Left",
       "penetration_rate" = 1,
       "penetration_rate_dec" = "2",
       "penetration_rate_title" = "Pen. Rate",
       "sum_rock_type" = 0,
       "sum_rock_type_just" = "Left",
       "volume_just" = "Left",
       "volume_on" = 1
      },
     "rep_burden_spacing" = 
      {
       "burden_dec" = "2",
       "burden_title" = "BURDEN",
       "burden_width" = "10",
       "show_burden" = 1,
       "show_spacing" = 1,
       "spacing_dec" = "2",
       "spacing_title" = "SPACING",
       "spacing_width" = "10"
      },
     "rep_drill" = u,
     "rep_drill_blast" = 
      {
       "drill_blast_title" = "Blast Name",
       "drill_blast_width" = "12",
       "show_blast_name" = 1
      },
     "rep_drill_col" = 
      {
       "collar_type_title" = "Collar",
       "collar_type_width" = "15",
       "gen_x_dec" = "4",
       "gen_x_title" = "COLLAR X",
       "gen_x_width" = "10",
       "gen_y_dec" = "4",
       "gen_y_title" = "COLLAR Y",
       "gen_y_width" = "10",
       "gen_z_dec" = "4",
       "gen_z_title" = "COLLAR Z",
       "gen_z_width" = "10",
       "hole_name_title" = "HOLE ID",
       "hole_name_width" = "10",
       "show_collar" = 0,
       "show_collar_x" = 1,
       "show_collar_y" = 1,
       "show_collar_z" = 1,
       "show_hole_label" = 1
      },
     "rep_drill_custom" = 
      {
       "drill_cust_title" = "Comment",
       "drill_cust_width" = "10",
       "show_comments" = 0
      },
     "rep_drill_dimen" = 
      {
       "ddim_hole_length_dec" = "4",
       "ddim_hole_length_title" = "DEPTH",
       "ddim_hole_length_width" = "10",
       "ddim_subdrill_dec" = "1",
       "ddim_subdrill_length_dec" = "1",
       "ddim_subdrill_length_title" = "SUBDRILL",
       "ddim_subdrill_length_width" = "15",
       "ddim_subdrill_title" = "SUBDRILL",
       "ddim_subdrill_width" = "10",
       "ddim_target_length_dec" = "1",
       "ddim_target_length_title" = "TARGET",
       "ddim_target_length_width" = "10",
       "show_hole_length" = 1,
       "show_subdrill" = 0,
       "show_subdrill_length" = 1,
       "show_target_length" = 1
      },
     "rep_drill_dir" = 
      {
       "dd_rep_bearing_dec" = "2",
       "dd_rep_bearing_title" = "BEARING",
       "dd_rep_bearing_width" = "10",
       "rb_bottom_up" = 0,
       "rb_decimal_degrees" = 1,
       "rb_dms" = 0,
       "rb_top_down" = 1,
       "rd_decimal_degrees" = 1,
       "rd_dms" = 0,
       "rd_rep_dip_dec" = "2",
       "rd_rep_dip_horiz" = 0,
       "rd_rep_dip_title" = "ANGLE",
       "rd_rep_dip_vert" = 1,
       "rd_rep_dip_width" = "10",
       "show_bearing" = 1,
       "show_dip" = 1
      },
     "rep_drill_rig" = 
      {
       "drill_diameter_dec" = "3",
       "drill_diameter_title" = "DIAMETER",
       "drill_diameter_width" = "10",
       "drill_rig_title" = "Drill Rig",
       "drill_rig_width" = "12",
       "show_drill_diam" = 1,
       "show_drill_rig" = 0
      },
     "rep_drill_toe" = 
      {
       "gen_x_dec" = "2",
       "gen_x_title" = "Toe X",
       "gen_x_width" = "10",
       "gen_y_dec" = "2",
       "gen_y_title" = "Toe Y",
       "gen_y_width" = "10",
       "gen_z_dec" = "2",
       "gen_z_title" = "Toe Z",
       "gen_z_width" = "10",
       "show_toe" = 0,
       "show_toe_x" = 0,
       "show_toe_y" = 0,
       "show_toe_z" = 0,
       "toe_type_title" = "Toe",
       "toe_type_width" = "12"
      },
     "rep_exp" = u,
     "rep_exp_load" = 
      {
       "exp_bulk" = 1,
       "exp_holebyhole" = 0,
       "exp_initiating" = 1,
       "exp_loading_calc_powder" = 1,
       "exp_loading_density" = "2.4",
       "exp_loading_report" = 0,
       "exp_summary" = 1,
       "loading_holebyhole_cost_title" = "Cost",
       "loading_holebyhole_cost_width" = "10",
       "loading_holebyhole_exp_title" = "Explosive",
       "loading_holebyhole_exp_width" = "30",
       "loading_holebyhole_hole_title" = "Hole Name",
       "loading_holebyhole_hole_width" = "10",
       "loading_holebyhole_quan_title" = "Quantity",
       "loading_holebyhole_quan_width" = "10",
       "loading_holebyhole_units_title" = "Units",
       "loading_holebyhole_units_width" = "10",
       "loading_summary_cost_title" = "Cost",
       "loading_summary_cost_width" = "10",
       "loading_summary_exp_width" = "30",
       "loading_summary_expb_title" = "Bulk Explosives",
       "loading_summary_expi_title" = "Initiating Explosives",
       "loading_summary_quan_title" = "Quantity",
       "loading_summary_quan_width" = "10",
       "loading_summary_units_title" = "Units",
       "loading_summary_units_width" = "10"
      },
     "rep_exp_surface" = 
      {
       "exp_surf_holebyhole" = 0,
       "exp_surf_summary" = 1,
       "exp_surface" = 0,
       "surface_holebyhole_cost_title" = "Cost",
       "surface_holebyhole_cost_width" = "10",
       "surface_holebyhole_exp_title" = "Surface Delay",
       "surface_holebyhole_exp_width" = "30",
       "surface_holebyhole_hole_title" = "Hole Name",
       "surface_holebyhole_hole_width" = "10",
       "surface_holebyhole_quan_title" = "Quantity",
       "surface_holebyhole_quan_width" = "10",
       "surface_holebyhole_units_title" = "Units",
       "surface_holebyhole_units_width" = "10",
       "surface_summary_cost_title" = "Cost",
       "surface_summary_cost_width" = "10",
       "surface_summary_exp_title" = "Surface Delay",
       "surface_summary_exp_width" = "30",
       "surface_summary_quan_title" = "Quantity",
       "surface_summary_quan_width" = "10",
       "surface_summary_units_title" = "Units",
       "surface_summary_units_width" = "10"
      },
     "rep_exp_timing" = 
      {
       "exp_allholes" = 0,
       "exp_calc_ppv" = 0,
       "exp_ignore_downhole" = 0,
       "exp_include_downhole" = 1,
       "exp_ppv_beta" = "0.5",
       "exp_ppv_east" = "",
       "exp_ppv_k" = "1140.0",
       "exp_ppv_n" = "-1.6",
       "exp_ppv_north" = "",
       "exp_ppv_rl" = "",
       "exp_show_details" = 0,
       "exp_show_number" = 1,
       "exp_show_totals" = 1,
       "exp_timing_report" = 0,
       "exp_timing_window" = "20"
      },
     "rep_interval_info" = 
      {
       "gen_x_dec" = "2",
       "gen_x_title" = "Interval X",
       "gen_x_width" = "12",
       "gen_y_dec" = "2",
       "gen_y_title" = "Interval Y",
       "gen_y_width" = "12",
       "gen_z_dec" = "2",
       "gen_z_title" = "Interval Z",
       "gen_z_width" = "12",
       "interval_length_dec" = "1",
       "interval_length_title" = "Interval Length",
       "interval_length_width" = "16",
       "interval_type_title" = "Interval",
       "interval_type_width" = "12",
       "rock_type_title" = "Rock Type",
       "rock_type_width" = "10",
       "show_interval" = 0,
       "show_interval_len" = 0,
       "show_interval_x" = 0,
       "show_interval_y" = 0,
       "show_interval_z" = 0,
       "show_rock" = 0
      },
     "rep_lay" = u,
     "rep_prefs" = u,
     "version" = 1
    },

EOS1

	# open the .dab file
	unlink ("specifications.new") if (-e "specifications.new");
	
	if (! -e "specifications.dab") {
		if (open(DABNEW,">specifications.dab"))
		{
			print DABNEW "{\n  \"report\" = \n  {\n$dbsspec  }\n}\n";	
			close DABNEW;
			Lava::Report(" Created specifications.dab\n");	
		} else {
			Lava::Error(" Unable to create specifications.dab");
			return 0;	
		}
	
	} elsif (open(DAB,"<specifications.dab")) {
		if (open(DABNEW,">specifications.new"))
		{
			my ($row,$linein,$foundrep,$withinDBS,$depthdbs,$depth);
			
			while (<DAB>) {
				$row++;
				chomp;
				$linein = $_;
				$depth++ if ($linein =~ /{/); 
				$depth-- if ($linein =~ /}/);
				
				if (!$depth and !$foundrep) {
					# never found a report section so add one	
				print DABNEW " ,\n  \"report\" = \n  {\n$dbsspec  }\n}\n";
				
				} elsif ($linein =~ /\"report\" =/) {
					
					#Lava::Report(" WithinReport $row $linein\n");
					# we are inside report section so insert the imbedded DBS 
					<DAB>; # right {
					chomp; 
					$row++; 
					print DABNEW "$linein\n  {\n$dbsspec";
					$foundrep = 1;
				
				} elsif ($linein =~ /\"DBS\" =/) {
					$withinDBS = 1;
					$depthdbs = 0;
				
				} elsif ($withinDBS) {
					
					#Lava::Report(" WithinDBS $row depth $depth $linein\n");
					
					# skip over the existing DBS section
					$depthdbs++ if ($linein =~ /{/); 
					$depthdbs-- if ($linein =~ /}/);
					$withinDBS = 0 if (!$depthdbs);  # out of DBS section
				
				} else {
					print DABNEW "$linein\n";
				}
				
			}	
			close DABNEW;
			close DAB;
			
			unlink ("specifications.sav") if (-e "specifications.sav");
			rename "specifications.dab", "specifications.sav";
			rename "specifications.new", "specifications.dab";
			Lava::Report(" Modified specifications.dab\n  Backup specifications.sav");
			
			# replace dab file and keep backup
			# --------------------------------	
		
		} else {
			Lava::Error(" Unable to open specifications.new for output");
			return 0;
		}
	} else {
		Lava::Error(" Unable to open specifications.dab for input");
		return 0;
	}
	return 1;
}

sub dps {
#----------------------------------
# round $data to $dp decimal places
#----------------------------------
      my ($data,$dp) = @_;
      $data = $data * (10**$dp);
      if ($data < 0) 
      {
            $data = $data - 0.5;
      } else {
            $data = $data + 0.5;
      }
      $data = int($data)/(10**$dp);
      return $data;
}

sub pointinpolygon {
#----------------------------------------------------------------------
# Test if point is inside polygon defined by first $Boundverts points
# of VertexList $$poly.
#
#  returns 0 outside, 1 inside, 2 on a point or boundary
	my ($tx, $ty, $poly) = @_;
	
	$Boundverts = scalar (@{$poly});
    # Lava::Message "PinPolygon $tx $ty boundverts = $Boundverts \n";
    
    my ($vtx0, $vtx1, $yflag0, $crossings, $j, $xint,$dx,$dy);
    
    # return inside if no boundary points
    return 1 unless $Boundverts >= 2;
     
    $vtx0 = $Boundverts - 1;
 
    # get test bit for above/below X axis 
 
    $yflag0 = ( $$poly[$vtx0][1] >= $ty ) ;
    $vtx1 = 0 ;

    #  check if we are on a boundary point
    #  -----------------------------------
    for ( $j = 0; $j < $Boundverts ;$j++) {
        if ( "$tx,$ty" eq "$$poly[$j][0],$$poly[$j][1]") {
        	Lava::Report "pointinpolygon on point:($tx,$ty) polypoints:$Boundverts inside_flag = 2 " if ($debug);
            return 2;
        } 
    }

    $crossings = 0 ;
 
    for ( $j = 0; $j < $Boundverts ;$j++) {

        $yflag1 = ( $$poly[$vtx1][1] >= $ty ) ;
    
        # check if endpoints straddle (are on opposite sides) of X axis
        #(i.e. the Y's differ); if so, +X ray could intersect this edge.
    	#Lava::Report "Crossings:$crossings j:$j yflags $yflag0 != $yflag1" if ($debug);
        $dx = abs($$poly[$vtx1][0] - $$poly[$vtx0][0]) + $dSmall;
        if  ((abs($$poly[$vtx0][1] - $ty) < $dSmall and abs($$poly[$vtx1][1] - $ty) < $dSmall) and 
        	 (abs($$poly[$vtx0][0] - $tx) < $dx and abs($$poly[$vtx1][0] - $tx) < $dx))
        {
        	Lava::Report "pointinpolygon on horizontal boundary point:($tx,$ty) polypoints:$Boundverts inside_flag = 2 " if ($debug);
        	return 2;
    	}	
    	$dy = abs($$poly[$vtx1][1] - $$poly[$vtx0][1]) + $dSmall;
        if  ((abs($$poly[$vtx0][0] - $tx) < $dSmall and abs($$poly[$vtx1][0] - $tx) < $dSmall) and 
        	 (abs($$poly[$vtx0][1] - $ty) < $dy and abs($$poly[$vtx1][1] - $ty) < $dy))
        {
        	Lava::Report "pointinpolygon on vertical boundary point:($tx,$ty) polypoints:$Boundverts inside_flag = 2 " if ($debug);
        	return 2;
    	}
    	 
        if ( $yflag0 != $yflag1 ) {
        	# we are on opposite sides in Y of point 
        	$xflag0 = ( $$poly[$vtx0][0] > $tx ) ;
        	
            #  check if endpoints are on same side of the Y axis (i.e. X's
            #  are the same); if so, it's easy to test if edge hits or misses.
            if ( $xflag0 == ( $$poly[$vtx1][0] > $tx ) ) {

                #  if edge's X values both right of the point, must hit */
 
                if ( $xflag0 ) {
                    if ( $yflag0) {
                        $crossings += -1;
                    } else {
                        $crossings += 1;
                    }
                }
            } else {
       			$xint = ($$poly[$vtx1][0] - ($$poly[$vtx1][1] - $ty) *
                     ($$poly[$vtx0][0] - $$poly[$vtx1][0])/
                     ($$poly[$vtx0][1] - $$poly[$vtx1][1]));
       			
                #  compute intersection of polygon segment with +X ray, note
                #  if >= point's X; if so, the ray hits it.
                if (abs($xint - $tx) < $dSmall)
                {
                	# on boundary 
                	Lava::Report "pointinpolygon on boundary:($tx,$ty) polypoints:$Boundverts inside_flag = 2 " if ($debug);
                	return 2;
                	
                } elsif ($xint > $tx ) {
                    
                    if ( $yflag0) {
                        $crossings += -1;
                    } else {
                        $crossings += 1;
                    }
                }
            }
        }
        #  move to next pair of vertices, retaining info as possible 
        $yflag0 = $yflag1 ;
        $vtx0 = $vtx1 ;
        $vtx1 += 1 ;
    }
 
    #  test if crossings is not zero 
    my $inside_flag = 1* ($crossings != 0) ;
 
    Lava::Report "pointinpolygon point:($tx,$ty) polypoints:$Boundverts inside_flag = $inside_flag " if ($debug);
    return $inside_flag ;
}

sub checkinside {
#-------------------------------------------------
# check all points of polyj are inside or on polyi
	my ($polyi,$polyj) = @_;
	
	for my $i (0..$#$polyj)
	{
		my ($xc,$yc) = (@{$$polyj[$i]});
		my $flag = &pointinpolygon($xc,$yc,$polyi);
		Lava::Report "checkinside i:$i $xc,$yc  flag:$flag" if ($debug);
		if ($flag == 0)
		{
			return 0;
		}
	}
	return 1;
}

sub checkoutside {
#--------------------------------------------------
# check all points of polyj are outside or on polyi
	my ($polyi,$polyj) = @_;
	
	for my $i (0..$#$polyj)
	{
		my ($xc,$yc) = (@{$$polyj[$i]});
		my $flag = &pointinpolygon($xc,$yc,$polyi);
		Lava::Report "checkoutside i:$i $xc,$yc  flag:$flag" if ($debug);
		if ($flag == 1)
		{
			return 0;
		}
	}
	return 1;
}


sub checkcrossing {
#---------------------------------------------------------------------------------------------
# check if 2 polygons cross. That is a point is inside the other or has a segment intersection
	my ($polyi,$polyj) = @_;
 	my (@segments,$flag,$xi,$yi);
 	
 	# first check if any point of polyj is inside polyi
	return 0 if (!&checkoutside($polyi,$polyj) or !&checkoutside($polyj,$polyi));
 	
 	my $i0 = $#$polyi;
 	my $j0 = $#$polyj;

	for my $i1 (0..$#$polyi)
	{
		for my $j1 (0..$#$polyj)
		{
			@segments = (\@{$$polyi[$i0]},
					     \@{$$polyi[$i1]},
					     \@{$$polyj[$j0]},
					     \@{$$polyj[$j1]}
								);
					($flag,$xi,$yi) = &SegmentIntersection(\@segments);
					Lava::Report "SegInt polyi:$i0 to $i1 polyj:$j0 to $j1 flag:$flag $xi,$yi" if ($debug);
					if ($flag == 1)
					{
						return 0;
					}
			
			$j0 = $j1;	# move on 2nd poly
		}
		$i0 = $i1;		# move on 1st poly	
	}		
	return 1;			
}

sub Determinant {
	my ($x1,$y1,$x2,$y2) = @_;
  	return ($x1*$y2 - $x2*$y1);
}

sub SegmentIntersection {
  	my $pointsref = $_[0];
  	my @points = @$pointsref;
  	if (@points != 4) {
  		Lava::Report("SegmentIntersection needs 4 points");
  	  	return;
  	}
  	my @p1 = @{$points[0]}; # p1,p2 = segment 1
  	my @p2 = @{$points[1]};
  	my @p3 = @{$points[2]}; # p3,p4 = segment 2
  	my @p4 = @{$points[3]};
  	
  	Lava::Report " SegmentIntersection $p1[0],$p1[1] $p2[0],$p2[1] $p3[0],$p3[1] $p4[0], $p4[1]" if ($debug);
  	
  	my @p5;
  	my $n1 = Determinant(($p3[0]-$p1[0]),($p3[0]-$p4[0]),($p3[1]-$p1[1]),($p3[1]-$p4[1]));
  	my $n2 = Determinant(($p2[0]-$p1[0]),($p3[0]-$p1[0]),($p2[1]-$p1[1]),($p3[1]-$p1[1]));
  	my $d  = Determinant(($p2[0]-$p1[0]),($p3[0]-$p4[0]),($p2[1]-$p1[1]),($p3[1]-$p4[1]));
  	if (abs($d) < $dSmall) {
  		#Lava::Report "PARALLEL ";
  	  	return 0; # parallel
  	}
  	if (!(($n1/$d < 1) && ($n2/$d < 1) && ($n1/$d > 0) && ($n2/$d > 0))) {
  	#if (!(($n1/$d <= 1) && ($n2/$d <= 1) && ($n1/$d >= 0) && ($n2/$d >= 0))) {
  		return 0;
  	}
  	$p5[0] = $p1[0] + $n1/$d * ($p2[0] - $p1[0]);
  	$p5[1] = $p1[1] + $n1/$d * ($p2[1] - $p1[1]);
  	
  	# check dist to each point and return 2 if point at intersection 
  	if (sqrt(($p5[0] - $p1[0])**2 + ($p5[1] - $p1[1])**2) < $dSmall or
  		sqrt(($p5[0] - $p2[0])**2 + ($p5[1] - $p2[1])**2) < $dSmall or
  		sqrt(($p5[0] - $p3[0])**2 + ($p5[1] - $p3[1])**2) < $dSmall or
  		sqrt(($p5[0] - $p4[0])**2 + ($p5[1] - $p4[1])**2) < $dSmall) 
  	{
  		return 2,@p5;
  	} else {
  		return 1,@p5; 
  	}
}

sub myRunCommand
{
    my ($cmd, $AutoClose, $wait4it) = @_;

    $AutoClose = 1 unless defined $AutoClose;
    
    # mds 20171020 have to use a bat file because FILES_RUN_COMMAND appears to truncate the command
    unlink "_temp.bat";	
    if (open BAT, ">_temp.bat")
    {
        print BAT "$cmd\n";     
        close BAT;
    }

    RunMenu("FILES_RUN_COMMAND","abort",
      sub { PanelResults("files_Run_Command",
                "button_pressed" => "ok",
                "console" => "envis",
                "inside_shell" => "1",
                "wait" => "$wait4it",
                "auto_close" => "$AutoClose",
                "command" => "_temp.bat"
                   ); },
      "FINISH") || Lava::Error "Unable to run command: $cmd";
}
