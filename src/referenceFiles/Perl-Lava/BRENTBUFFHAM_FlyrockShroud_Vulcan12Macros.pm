#!/usr/bin/perl
use Math::Trig qw(pi asin acos atan);
use List::Util qw(max);
use Data::Dumper;

use utf8;
use Lava;
use Macro;
use vulcan;
use strict;
use warnings;
use File::Spec;


#################################################################################
#
#      Title           : BRENTBUFFHAM_FlyrockShroud_Vulcan12Macros.lava
#      Version         : 1.0
#      Author          : Brent Buffham
#
#      Description     : Flyrock Shroud for Vulcan 
#
#      Primary Use(s)  : Starting a Lava
#
#      Version 01 Date : 7-04-2022
#
################################################################################

#flushes output as it occurs...
$|=1;

#constants
my $GRAVITY = 9.80665; 
my $PI = 3.141592653589793238;
my $iterations = 40;

#arrays
my (@xS, @yS, @zS, @draw);
my (@alt, @diam);
my (@triList,@delList,@changedArray);

#Inputs
my $rockDensity = 3;
my $holeDiameter = 115;
my $benchHeight = 12;
my $stemmingLength = 2;
my $burden = 3.6;
my $spacing = 4.2;
my $subdrill = 1;
my $inholeDensity = 1.2;
my $flyRockConstant = 20;
my $factorSafety = 2;
my $stemEjectAngle = 80;
my $specificDistance = 5;

#Calculations
my $chargeLength;
my $massPerMeter;

#Scaled Distance Calculations
my $contributingHoleDiameters;
my $contributingChargeLen;

#Max Horizontal Distance Calculations
my $faceBurstDistance;
my $crateringDistance;
my $stemEjectDistance;
my $envelopeInterval;
my $maxVelocity;
my $maxDistance;

#Launch Velocity Calculations
my $launchVelocityFB;
my $launchVelocityCR;
my $launchVelocitySE;

my $height;

my $colour;
my $objectName;
my $layerName;
my $layer;
my $loop   = 1;
my $i = 0;
my $pID = 0;
my $f = 0;
my $k = 0;
my $scale = 1;

my $boolTri = 0;
my $boolDist = 0;
my $boolRemDel = 0;
my $boolLayerDel = 0;

my $poly;
my $triPath;
my $listToShrink;

my %userSettings;

my $count = 0;


&loadDefaults;

while ( $loop == 1 )
{
	
	my $panel  = new Lava::Panel;

	#$panel->logical_button("Add Hole marker.",\$doMark);
	$panel->text("___________________________________________________________________________ ");
	$panel->text("Beware that more than 150 points my cause Vulcan issues");
	$panel->text("___________________________________________________________________________ ");
	$panel->text("Display Details");
	$panel->logical_button("        Triangulate Shroud?", \$boolTri);
	$panel->item("Triangulation Path : ", \$triPath, 300);
	$panel->numeric("   Iterations (No.)                  ", \$iterations, 2, 0 );
	$panel->logical_button("         Specific Distance?   ", \$boolDist);
	$panel->numeric("   Specified dist for iterations     ", \$specificDistance, 2, 1 );
	$panel->colour("   Poly Shroud Colour Picker          ", \$colour );
	$panel->text(" ");
	$panel->text("Pattern Details");
	$panel->numeric("   Hole Diameter (mm)                ", \$holeDiameter, 4, 0 );
	$panel->numeric("   Bench Height (m)                  ", \$benchHeight, 3, 2 );
	$panel->numeric("   Stemming Length (m)               ", \$stemmingLength, 2, 2 );
	$panel->numeric("   Burden (m)                        ", \$burden, 2, 2 );
	$panel->numeric("   Spacing (m)                       ", \$spacing, 2, 2 );
	$panel->numeric("   Subdrill (m)                      ", \$subdrill, 2, 2 );
	$panel->text(" ");
	$panel->text("Density Details");
	$panel->numeric("   Rock Density (kg/m3)              ", \$rockDensity, 2, 2 );
	$panel->numeric("   Product Inhole Density (kg/L)     ", \$inholeDensity, 2, 2 );
	$panel->text(" ");
	$panel->text("Flyrock Details");
	$panel->numeric("   Flyrock Constant (K)              ", \$flyRockConstant, 2, 1 );
	$panel->numeric("   Factor of Safety (No.)            ", \$factorSafety, 2, 2 );
	$panel->numeric("   Stemming Ejection Angle (degs)    ", \$stemEjectAngle, 2, 1 );
	$panel->text(" ");
	$panel->logical_button("        Remove and Delete Created Triangulations?", \$boolRemDel);
	$panel->logical_button("        Delete Created Polygons?", \$boolLayerDel);
	$panel->text("___________________________________________________________________________ ");

	$panel->text("- Flyrock Calcs based on Richards and Moores Paper.");
	$panel->text("- Macros in this Lava were recorded in Vulcan 12.0.5");
	$panel->text("- Macros need to be re-recorded if newer versions of Vulcan are used.");
	$panel->text("___________________________________________________________________________ ");
    $panel->text("Lava code by Brent Buffham (brent.buffham\@gmail.com)");


	if ( $panel->execute("User Inputs Panel") )
	{	
		
		$f = 0;	

		for ( my $object = new Lava::Selection( "Select object.", "multi,shadow" ) ; $object->has_more ; $object->next )
		{
			$i = 0;

			if ( $object->is_poly)
			{
				$layerName = $object->layer; #get the selected objects layer Name and store
				$objectName = $object->name; #get the selected objects Name and store
				Lava::Report("Objects Selected");
				
				#Selected Point(s)
				my ( $x, $y, $z, $w, $con, $name ) = $object->coordinates->i;
				$xS[$i] = $x;
				$yS[$i] = $y;
				$zS[$i] = $z;
				
				my $tempY = sprintf( "%.3f", $xS[$i] );
				my $tempX = sprintf( "%.3f", $yS[$i] );
				my $tempZ = sprintf( "%.3f", $zS[$i] );
				
				#Calculations
				$chargeLength = $benchHeight + $subdrill - $stemmingLength;
				Lava::Report("Charge Length = $chargeLength");
				$massPerMeter = ($PI * (($holeDiameter/2) **2) * $inholeDensity) /1000;
				Lava::Report("Mass per Meter = $massPerMeter");
				
				#Max Horizontal Distance Calculations
				$faceBurstDistance = ( (($flyRockConstant ** 2) / $GRAVITY) * ((sqrt($massPerMeter)/$burden) ** 2.6)) * $factorSafety;
				Lava::Report("Face Burst Distance = $faceBurstDistance");
				
				$crateringDistance =( (($flyRockConstant ** 2) / $GRAVITY) * ((sqrt($massPerMeter)/$stemmingLength) ** 2.6)) * $factorSafety;
				Lava::Report("Cratering Distance = $crateringDistance");
				
				$stemEjectDistance =( (($flyRockConstant ** 2) / $GRAVITY) * ((sqrt($massPerMeter)/$stemmingLength) ** 2.6) * sin((2*$stemEjectAngle)*($PI/180))) * $factorSafety;
				Lava::Report("Stemming Ejection Distance = $stemEjectDistance");
				
				$maxDistance = (max $crateringDistance, $faceBurstDistance, $stemEjectDistance);
				Lava::Report("Max Distance = $maxDistance");
				
				#$envelopeInterval = (($maxVelocity * 1.5) / 10) * 2;
				$envelopeInterval = ($maxDistance/($iterations/2));
				Lava::Report("Envelope Interval = $envelopeInterval");
			
				#Launch Velocity Calculations
				$launchVelocityFB = (($faceBurstDistance * $GRAVITY) ** 0.5 );
				Lava::Report("Launch Velocity (Face Burst) = $launchVelocityFB");
				$launchVelocityCR = sqrt(($crateringDistance * $GRAVITY) / (sin((2*45)*($PI/180))));
				Lava::Report("Launch Velocity (Cratering) = $launchVelocityCR");
				$launchVelocitySE = sqrt(($stemEjectDistance * $GRAVITY) / (sin((2*$stemEjectAngle) * ($PI/180))));
				Lava::Report("Launch Velocity (Stemming Ejection) = $launchVelocitySE");
				$maxVelocity = (max $launchVelocityFB, $launchVelocityCR, $launchVelocitySE);
				Lava::Report("Max Velocity = $maxVelocity");

				#Lava::Message($triPath);
				
				for(my $k = 0; $k<$iterations; $k++)
				{
					$diam[$k] = ($k*$envelopeInterval);
					if($boolDist == 1) {
						$diam[$k] = ($k * $specificDistance) ;
					}
					
					$alt[$k] = ($maxVelocity**4 - $GRAVITY**2 * ($diam[$k]**2)) / ( 2* $GRAVITY * ($maxVelocity **2) );

					my $dist;
					my $zAlt;
					$poly = new Lava::Obj();
					&circle( $xS[$i], $yS[$i], $diam[$k]);
					for($pID = 0; $pID < scalar(@xS); $pID++ )
					{
						my $cnt = $pID + 1 ;
						$poly->coordinates->i($pID, $xS[$pID], $yS[$pID], $z+$alt[$k], "w-Value", 1,($pID+1));
						$poly->colour($colour);
						$poly->closed(1);
						
						$dist = sprintf("%.1f", $diam[$k]);
						$zAlt = sprintf("%.1f", $z+$alt[$k]);
					
						$poly->name("FSpoly$k");
						$poly->group("FSGroup$f");

						$xS[$i] = $x;
						$yS[$i] = $y;
						$zS[$i] = $z;
					}
					Lava::Report("Group ID = FSGroup$f");
					Lava::Report("Polyname = FSpoly$k");
					Lava::Report("Distance = $dist");
					Lava::Report("Altitude = $zAlt");
					$layer = new Lava::Layer("SHROUD_FOR_".$object->layer);
					$layer->edited(1);
					$layer->add($poly);	
					$changedArray[$k] = $poly->name;
				}
				
				Lava::Report("Object[$objectName], x[$tempX], y[$tempY], z[$tempZ]");
			}
			$i++;

			if($boolTri == 1){
				&triShroud("FSGroup$f", $f+1);
				$triList[$f] = [File::Spec->catfile($triPath, "TRI_FSGroup$f.00t")]; 
				$delList[$f] = 	File::Spec->catfile($triPath, "TRI_FSGroup$f.00t");
			}
			
			$f++;	
		}
		print "Hello $triList[0][0]";
		print Dumper(\@triList);
		if($boolTri == 1){
			&triShrink(\@triList, $colour);
			&makeTriSeeThru();
			&makeAllTriShadow();
		}
		
		if($boolLayerDel)
		{
			&deleteLayer($layerName);
			# Notify Vulcan that the layer has been altered
			$layer->edited(1);
		}			
		&saveDefaults;	
		
		#Remove all the Created Trianulations that are in the Group.
		if($boolTri == 1){
			if($boolRemDel)
			{
				&triRemove();
				
				# Deleted the Triangulations from the file structure
				for(my $d = 0; $d< scalar(@delList); $d++) 
				{
					&deleteTriFile($delList[$d]);
				}
			}
		}
	}
	else
	{
		&makeAllTriVisible();
		&saveDefaults;
		$loop = 0;
	}
}
####################################################### 
# Deletes the Layer that was created 
#######################################################
sub deleteLayer
{
	for (my $j = 0; $j < @changedArray; $j++)
	{
		RunMenu("DESIGN_OBJ_DELETE","abort",
		sub { SelectObjects("*","$changedArray[$j]","*","*"); },
		"SELECT_CANCEL",
		"FINISH") || print "Macro mismatch.\n";
	}
}
####################################################### 
# Removes from Screen all TRI_FSGroup* Triangulations
#######################################################
sub circle
{
	my ( $refX4, $refY4, $refS) = @_;
	&clearArrays;
	$scale = $refS;
	# no pen as is all drawn
	$xS[0] = (   0.0000 * $scale )  + $refX4;
	$xS[1] = (   0.1740 * $scale )  + $refX4;
	$xS[2] = (   0.3420 * $scale )  + $refX4;
	$xS[3] = (   0.5000 * $scale )  + $refX4;
	$xS[4] = (   0.6430 * $scale )  + $refX4;
	$xS[5]  = (  0.7660 * $scale )  + $refX4;
	$xS[6]  = (  0.8660 * $scale )  + $refX4;
	$xS[7]  = (  0.9400 * $scale )  + $refX4;
	$xS[8]  = (  0.9850 * $scale )  + $refX4;
	$xS[9]  = (  1.0000 * $scale )  + $refX4;
	$xS[10] = (  0.9850 * $scale )  + $refX4;
	$xS[11] = (  0.9400 * $scale )  + $refX4;
	$xS[12] = (  0.8660 * $scale )  + $refX4;
	$xS[13] = (  0.7660 * $scale )  + $refX4;
	$xS[14] = (  0.6430 * $scale )  + $refX4;
	$xS[15] = (  0.5000 * $scale )  + $refX4;
	$xS[16] = (  0.3420 * $scale )  + $refX4;
	$xS[17] = (  0.1740 * $scale )  + $refX4;
	$xS[18] = (  0.0000 * $scale )  + $refX4;
	$xS[19] = (  -0.1730* $scale )  + $refX4;
	$xS[20] = (  -0.3420* $scale )  + $refX4;
	$xS[21] = (  -0.5000* $scale )  + $refX4;
	$xS[22] = (  -0.6420* $scale )  + $refX4;
	$xS[23] = (  -0.7660* $scale )  + $refX4;
	$xS[24] = (  -0.8660* $scale )  + $refX4;
	$xS[25] = (  -0.9390* $scale )  + $refX4;
	$xS[26] = (  -0.9840* $scale )  + $refX4;
	$xS[27] = (  -1.0000* $scale )  + $refX4;
	$xS[28] = (  -0.9840* $scale )  + $refX4;
	$xS[29] = (  -0.9390* $scale )  + $refX4;
	$xS[30] = (  -0.8660* $scale )  + $refX4;
	$xS[31] = (  -0.7660* $scale )  + $refX4;
	$xS[32] = (  -0.6420* $scale )  + $refX4;
	$xS[33] = (  -0.5000* $scale )  + $refX4;
	$xS[34] = (  -0.3420* $scale )  + $refX4;
	$xS[35] = (  -0.1730* $scale )  + $refX4;
	$yS[0]  = (  1.0000  * $scale ) + $refY4;
	$yS[1]  = (  0.9850  * $scale ) + $refY4;
	$yS[2]  = (  0.9400  * $scale ) + $refY4;
	$yS[3]  = (  0.8660  * $scale ) + $refY4;
	$yS[4]  = (  0.7670  * $scale ) + $refY4;
	$yS[5]  = (  0.6430  * $scale ) + $refY4;
	$yS[6]  = (  0.5000  * $scale ) + $refY4;
	$yS[7]  = (  0.3420  * $scale ) + $refY4;
	$yS[8]  = (  0.1740  * $scale ) + $refY4;
	$yS[9]  = (  0.0000  * $scale ) + $refY4;
	$yS[10] = (  -0.1730 * $scale ) + $refY4;
	$yS[11] = (  -0.3420 * $scale ) + $refY4;
	$yS[12] = (  -0.5000 * $scale ) + $refY4;
	$yS[13] = (  -0.6420 * $scale ) + $refY4;
	$yS[14] = (  -0.7660 * $scale ) + $refY4;
	$yS[15] = (  -0.8660 * $scale ) + $refY4;
	$yS[16] = (  -0.9390 * $scale ) + $refY4;
	$yS[17] = (  -0.9840 * $scale ) + $refY4;
	$yS[18] = (  -1.0000 * $scale ) + $refY4;
	$yS[19] = (  -0.9840 * $scale ) + $refY4;
	$yS[20] =  (  -0.9390 * $scale )  + $refY4;
	$yS[21] =  (  -0.8660 * $scale )  + $refY4;
	$yS[22] =  (  -0.7660 * $scale )  + $refY4;
	$yS[23] =  (  -0.6420 * $scale )  + $refY4;
	$yS[24] =  (  -0.5000 * $scale )  + $refY4;
	$yS[25] =  (  -0.3420 * $scale )  + $refY4;
	$yS[26] =  (  -0.1730 * $scale )  + $refY4;
	$yS[27] =  (  0.0000  * $scale )  + $refY4;
	$yS[28] =  (  0.1740  * $scale )  + $refY4;
	$yS[29] =  (  0.3420  * $scale )  + $refY4;
	$yS[30] =  (  0.5000  * $scale )  + $refY4;
	$yS[31] =  (  0.6430  * $scale )  + $refY4;
	$yS[32] = (   0.7670  * $scale ) + $refY4;
	$yS[33] = (   0.8660  * $scale ) + $refY4;
	$yS[34] = (   0.9400  * $scale ) + $refY4;
	$yS[35] = (   0.9850  * $scale ) + $refY4;
	return ( \@xS, \@yS );
}

####################################################### 
# Deletes all TRI_FSGroup* Triangulations
#######################################################
sub deleteTriFile
{
	my ($file) = @_;
	unlink($file) or die "Can't unlink $file: $!";
}

sub makeTriSeeThru
{
	
	my $outTri = File::Spec->catfile($triPath, "UNIFIED_SHROUD$count.00t");
	
	RunMenu("TRI_UTE_ATTRIBUTES","abort",
	sub { Triangulation("$outTri"); },
	sub { PanelResults("dgs_Tri_Info2",
			"VARY_OBJECT" => "",
			"separator_line" => "",
			"VARY_CRANGE" => "Z",
			"NAME" => "UNIFIED_SHROUD$count.00t",
			"SHADED" => "1",
			"datafiles_directory" => "$triPath",
			"USE_ICOLOUR" => "1",
			"TEXTURE" => "",
			"button_pressed" => "ok",
			"SMOOTH" => "0",
			"WIREFRAME" => "0",
			"CONTOUR" => "10.0",
			"VARY_SURFACE" => "",
			"STATIC_NORMALS" => "0",
			"LINES" => "0",
			"TRANSLUCENT" => "70",
			"NORM" => "0",
			"IRGB" => "65280",
			"USE_CRANGE" => "0",
			"FORCE_SHARP" => "0",
			"panel_change" => "1",
			"USE_TEXTURE" => "0",
			"scheme" => 
				{
				"colour_by" => "1"
				},
			"ICOLOUR" => "$colour",
			"BLEND" => "0",
			"EQUALISE_RANGE" => "0",
			"USE_SMOOTH" => "0",
			"USE_CONTOUR" => "0",
			"PATTERN" => "0",
			"VARY_LAYER" => "",
			"VARY_DATABASE" => "",
			"FILL" => "0",
			"USE_RGB" => "0",
			"USE_TRANSLUCENT" => "1"
		); },
	"FINISH");# || die "Macro mismatch.\n";
	
}
####################################################### 
# Shadows Screen all TRI_FSGroup* Triangulations
#######################################################
sub makeAllTriShadow
{
RunMenu("VIEW_VIS_TRI","abort",
		sub { PanelResults("Action",
				"button_pressed" => "SHADOW"
			); },
		sub { PanelResults("SM_visibility",
				"button_pressed" => "ok",
				"file_pattern" => "UNIFIED_SHROUD*"
			); },
		"FINISH");# || die "Macro mismatch.\n";
}
####################################################### 
# Makes all Visble all TRI_FSGroup* Triangulations
#######################################################
sub makeAllTriVisible
{
	RunMenu("VIEW_VIS_TRI","abort",
		sub { PanelResults("Action",
				"button_pressed" => "VISIBLE"
			); },
		sub { PanelResults("SM_visibility",
				"button_pressed" => "ok",
				"file_pattern" => "UNIFIED_SHROUD*"
			); },
		"FINISH");# || die "Macro mismatch.\n";
}


####################################################### 
# Removes from Screen all TRI_FSGroup* Triangulations
#######################################################
sub triRemove
{
	RunMenu("TRI_UTE_DESELECT","abort",
		sub { PanelResults("SM_remove_model_underlay",
			"use_list" => "0",
			"button_pressed" => "ok",
			"file_pattern" => "TRI_FSGroup*"
		); },
	"FINISH") ;#|| die "Remove Macro mismatch.\n";
}

####################################################### 
# Shrink wraps all TRI_FSGroup* Triangulations into one
#######################################################
sub triShrink
{
		my ( $list, $col) = @_;
		$count++;
		my $size = 5 * $factorSafety;
		my $outTri = File::Spec->catfile($triPath, "UNIFIED_SHROUD$count.00t");
		#unlink $outTri if -f $outTri;
		$col = $col-1;
		
	RunMenu("TRI_UTE_SHRINKWRAP","ignore",
   sub { PanelResults("SM_model_list",
         "line" => "",
         "button_pressed" => "ok",
         "has_model" => "0",
         "models" => $list,
         "modify_attributes" => "0",
         "save_selections" => "0"
      ); },
   sub { PanelResults("tri_shrinkwrap",
         "button_pressed" => "ok",
         "tri_shrinkwrap_options" => 
            {
            "extent_y" => "588.229061",
            "shrink_polygon_size" => "0.25",
            "extent_z" => "263.561487",
            "snap_to_grid" => "1",
            "target_precision" => "0.1",
            "size_x" => "$size",
            "normalise" => "1",
            "clean_edges" => "1",
            "size_y" => "$size",
            "use_cut_and_fill_for_solids" => "1",
            "calculated_precision" => "0.85",
            "shrink_polygon" => "0",
            "extent_x" => "593.279304"
            },
         "tri_shrinkwrap_save" => 
            {
            "tri_file_solid" => "",
            "tri_file_min" => "",
            "save_tri_file_max" => "1",
            "save_polygons" => "0",
            "tri_file_max" => "UNIFIED_SHROUD$count",
            "tri_file_solid_colour" => "1",
            "min_polygon_name" => "SW_BOUNDARY_MIN",
            "tri_file_min_colour" => "1",
            "tris_folder" => "$triPath",
            "max_polygon_name" => "SW_BOUNDARY_MAX",
            "layer" => "",
            "save_tri_file_solid" => "0",
            "tri_file_max_colour" => "$col",
            "display_all" => "1",
            "save_tri_file_min" => "0",
            "dgd_name" => ""
            },
         "tri_shrinkwrap_input" => 
            {
            "surface_list" => 
               {
               "value" => $list,
               "selection" => ""
               }
            }
      ); },
   "FINISH"); #|| die "Macro mismatch.\n";
		if( -f $outTri)
		{
			print "successfully created $outTri\n";
		}
		else
		{
			die Lava::Error("unable to create $outTri\n");
		}	
}

####################################################### 
# Individual Triangulations all FSGroup$f 
#######################################################
sub triShroud
{
	my ( $groupName, $colourCount) = @_;
	
	RunMenu("TRI_SURF_CREATE","abort",
	sub { PanelResults("tri_create",
			"button_pressed" => "ok",
			"data" => 
				{
				"w_off" => "0.0",
				"intersect" => "0",
				"break_tol" => "0.01",
				"proj_type" => "plan",
				"w_tags" => "0"
				},
			"trending" => 
				{
				"bearing" => "0.0",
				"major" => "1.0",
				"use_elipse_trend" => "0",
				"plunge" => "0.0",
				"use_poly_trend" => "0",
				"bound_constraint" => "0",
				"order" => "2",
				"dip" => "0.0",
				"minor" => "1.0",
				"max_area" => "500.0",
				"trend_model_only" => "0",
				"semimajor" => "1.0"
				},
			"boundary" => 
				{
				"bound_type" => "include",
				"boundary_polygon" => "0",
				"inside" => "1"
				},
			"spurs" => 
				{
				"spur_strings" => "0",
				"description" => "",
				"arb_level" => "1",
				"layer" => "",
				"incorporate" => "1"
				},
			"condition" => 
				{
				"min_angle" => "1.0",
				"no_flat" => "0",
				"trim" => "0",
				"min_area" => "0.01",
				"max_length" => "-1.0"
				}
		); },
	sub { SelectObjects("*","*","$groupName","*"); },
	"SELECT_CANCEL",
	sub { PanelResults("dgs_Tri_Info",
			"VARY_OBJECT" => "",
			"separator_line" => "",
			"VARY_CRANGE" => "O",
			"NAME" => "TRI_$groupName",
			"SHADED" => "1",
			"datafiles_directory" => "$triPath",
			"USE_ICOLOUR" => "1",
			"TEXTURE" => "",
			"button_pressed" => "ok",
			"SMOOTH" => "60",
			"WIREFRAME" => "0",
			"CONTOUR" => "10.0",
			"VARY_SURFACE" => "",
			"STATIC_NORMALS" => "0",
			"EDTCOL" => "0",
			"LINES" => "0",
			"TRANSLUCENT" => "50",
			"NORM" => "0",
			"IRGB" => "65280",
			"USE_CRANGE" => "0",
			"FORCE_SHARP" => "0",
			"panel_change" => "1",
			"scheme" => 
				{
				"colour_by" => "1"
				},
			"USE_TEXTURE" => "0",
			"ICOLOUR" => "$colourCount",
			"BLEND" => "0",
			"EQUALISE_RANGE" => "0",
			"USE_SMOOTH" => "0",
			"USE_CONTOUR" => "0",
			"PATTERN" => "0",
			"VARY_LAYER" => "",
			"VARY_DATABASE" => "",
			"FILL" => "0",
			"USE_RGB" => "0",
			"USE_TRANSLUCENT" => "0"
		); },
	"FINISH") ;#|| die "triShroud - Macro mismatch.\n";
}

#############################################
# CLEAR ARRAYS IN THIS SCRIPT
#############################################
sub clearArrays
{
	my @clean;
	@xS = @clean;
	@yS = @clean;
	@zS = @clean;
}
############################################
# Default Subroutines
############################################
sub loadDefaults
{

	# Load defaults into a hash
	dbmopen %userSettings, "BrentBuffham_FLYROCK_Defaults", 0666;

	#Set the values to the default values
	$rockDensity      = $userSettings{'rockDensity'}     || 3;
	$iterations       = $userSettings{'iterations'}		 || 20;
	$holeDiameter     = $userSettings{'holeDiameter'}    || 165;
	$benchHeight      = $userSettings{'benchHeight'}     || 12;
	$stemmingLength   = $userSettings{'stemmingLength'}  || 2.5;
	$burden           = $userSettings{'burden'}          || 4.5;
	$spacing          = $userSettings{'spacing'}         || 5.2;
	$subdrill         = $userSettings{'subdrill'}        || 1.5;
	$inholeDensity    = $userSettings{'inholeDensity'}   || 1.2;
	$flyRockConstant  = $userSettings{'flyRockConstant'} || 20;
	$factorSafety     = $userSettings{'factorSafety'}    || 2;
	$stemEjectAngle   = $userSettings{'stemEjectAngle'}  || 80;
	$boolTri          = $userSettings{'boolTri'}         || 1;
	$colour           = $userSettings{'colour'}          || 1;
	$specificDistance = $userSettings{'specificDistance'}|| 5;
	$boolDist         = $userSettings{'boolDist'}        || 0;
	$triPath		  = $userSettings{'triPath'}		 || "C:\\Temp\\";
	$boolRemDel       = $userSettings{'boolRemDel'}      || 0;
	$boolLayerDel	  = $userSettings{'boolLayerDel'}    || 0;

	dbmclose %userSettings;
}

sub saveDefaults
{

	# Save defaults into a hash
	dbmopen %userSettings, "BrentBuffham_FLYROCK_Defaults", 0666;

	# Save the default values to the below
	$userSettings{'rockDensity'}     = $rockDensity         ;
	$userSettings{'iterations'}      = $iterations          ;
	$userSettings{'holeDiameter'}    = $holeDiameter        ;
	$userSettings{'benchHeight'}     = $benchHeight         ;
	$userSettings{'stemmingLength'}  = $stemmingLength      ;
	$userSettings{'burden'}          = $burden              ;
	$userSettings{'spacing'}         = $spacing             ;
	$userSettings{'subdrill'}        = $subdrill            ;
	$userSettings{'inholeDensity'}   = $inholeDensity       ;
	$userSettings{'flyRockConstant'} = $flyRockConstant     ;
	$userSettings{'factorSafety'}    = $factorSafety        ;
	$userSettings{'stemEjectAngle'}  = $stemEjectAngle      ;
	$userSettings{'boolTri'}         = $boolTri             ;
	$userSettings{'colour'}          = $colour              ;
	$userSettings{'specificDistance'}= $specificDistance    ;
	$userSettings{'boolDist'}        = $boolDist            ;
	$userSettings{'triPath'}	     = $triPath		        ;
	$userSettings{'boolRemDel'}      = $boolRemDel          ;
	$userSettings{'boolLayerDel'}    = $boolLayerDel       ;

	dbmclose %userSettings;
}
