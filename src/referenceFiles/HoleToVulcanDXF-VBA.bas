Attribute VB_Name = "Module3"
' Simple test function to debug cell reading with string conversion
Sub TestCellReading()
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Worksheets("MGA_DATA")
    
    Debug.Print "=== TESTING CELL READING WITH STRING CONVERSION ==="
    
    ' Test reading cells as strings first
    On Error GoTo ErrorHandler
    
    Debug.Print "A1 as string: '" & CStr(ws.Cells(1, 1).Value) & "'"
    Debug.Print "A2 as string: '" & CStr(ws.Cells(2, 1).Value) & "'"
    Debug.Print "B2 as string: '" & CStr(ws.Cells(2, 2).Value) & "'"
    Debug.Print "C2 as string: '" & CStr(ws.Cells(2, 3).Value) & "'"
    Debug.Print "D2 as string: '" & CStr(ws.Cells(2, 4).Value) & "'"
    
    ' Test conversion
    Dim testStr As String
    testStr = CStr(ws.Cells(2, 1).Value)
    Debug.Print "A2 string: '" & testStr & "' IsNumeric: " & IsNumeric(testStr)
    
    If IsNumeric(testStr) Then
        Dim testNum As Double
        testNum = CDbl(testStr)
        Debug.Print "Converted to double: " & testNum
    End If
    
    Exit Sub
    
ErrorHandler:
    Debug.Print "Error at: " & Err.Description
End Sub

Sub ExportHolesToDXF()
    Dim coordinateSystem As String
    Dim ws As Worksheet
    Dim blastName As String
    Dim layerName As String
    Dim lastRow As Long
    Dim actualLastRow As Long
    Dim i As Long
    Dim dxfContent As String
    Dim fileName As String
    Dim fileNum As Integer
    Dim response As VbMsgBoxResult
    Dim minX As Double, minY As Double, minZ As Double
    Dim maxX As Double, maxY As Double, maxZ As Double
    
    ' Get Blast Name from DATA!H4
    On Error Resume Next
    blastName = ThisWorkbook.Worksheets("DATA").Cells(4, 8).Value
    If blastName = "" Then
        MsgBox "Blast Name not found in DATA!H4!"
        Exit Sub
    End If
    On Error GoTo 0
    
    ' Prompt user to select coordinate system
    response = MsgBox("Select coordinate system:" & vbCrLf & vbCrLf & _
                     "YES = MGA (Map Grid Australia)" & vbCrLf & _
                     "NO = LOC (Local Coordinates)", _
                     vbYesNoCancel + vbQuestion, "Select Coordinate System")
    
    If response = vbCancel Then
        Exit Sub
    ElseIf response = vbYes Then
        coordinateSystem = "MGA"
        Set ws = ThisWorkbook.Worksheets("MGA_DATA")
        layerName = blastName & "_MGA"
    Else
        coordinateSystem = "LOC"
        Set ws = ThisWorkbook.Worksheets("LOC_DATA")
        layerName = blastName & "_LOCAL"
    End If
    
    ' Find the last row with data in column D (Hole No.)
    lastRow = ws.Cells(ws.Rows.Count, 4).End(xlUp).row
    
    ' Find the last row with actual hole data (non-blank, non-empty hole numbers)
    actualLastRow = 1 ' Start with header row
    For i = 2 To lastRow
        Dim checkCell As String
        checkCell = CStr(ws.Cells(i, 4).Value) ' Hole No. in column D
        If Len(Trim(checkCell)) > 0 And checkCell <> "" Then
            actualLastRow = i
        End If
    Next i
    
    lastRow = actualLastRow
    Debug.Print "Found actual data up to row: " & lastRow
    
    ' Check if there's data
    If lastRow < 2 Then
        MsgBox "No valid hole data found in " & coordinateSystem & " sheet!"
        Exit Sub
    End If
    
    ' Calculate approximate extents for HEADER
    minX = 1E+308: minY = 1E+308: minZ = 1E+308
    maxX = -1E+308: maxY = -1E+308: maxZ = -1E+308
    For i = 2 To lastRow
        If Len(Trim(CStr(ws.Cells(i, 4).Value))) > 0 And CStr(ws.Cells(i, 4).Value) <> "" Then
            If IsNumeric(ws.Cells(i, 1).Value) Then
                minX = WorksheetFunction.Min(minX, CDbl(ws.Cells(i, 1).Value))
                maxX = WorksheetFunction.Max(maxX, CDbl(ws.Cells(i, 1).Value))
            End If
            If IsNumeric(ws.Cells(i, 2).Value) Then
                minY = WorksheetFunction.Min(minY, CDbl(ws.Cells(i, 2).Value))
                maxY = WorksheetFunction.Max(maxY, CDbl(ws.Cells(i, 2).Value))
            End If
            If IsNumeric(ws.Cells(i, 3).Value) Then
                minZ = WorksheetFunction.Min(minZ, CDbl(ws.Cells(i, 3).Value))
                maxZ = WorksheetFunction.Max(maxZ, CDbl(ws.Cells(i, 3).Value))
            End If
        End If
    Next i
    
    ' Build DXF content
    dxfContent = BuildDXFHeader(minX, minY, minZ, maxX, maxY, maxZ)
    dxfContent = dxfContent & BuildDXFTables(layerName)
    dxfContent = dxfContent & "0" & vbCrLf & "SECTION" & vbCrLf & "2" & vbCrLf & "ENTITIES" & vbCrLf
    
    ' Process each hole (starting from row 2 to skip header)
    For i = 2 To lastRow
        On Error GoTo SkipRow
        dxfContent = dxfContent & CreateHolePolyline(ws, i, coordinateSystem, layerName)
        GoTo NextRow
SkipRow:
        Debug.Print "Error processing row " & i & ": " & Err.Description
        Resume NextRow
NextRow:
    Next i
    
    ' Close DXF file
    dxfContent = dxfContent & "0" & vbCrLf & "ENDSEC" & vbCrLf & "0" & vbCrLf & "EOF" & vbCrLf
    
    ' Save to file
    fileName = Application.GetSaveAsFilename(initialFileName:="Holes_" & coordinateSystem & "_Export.dxf", _
                                           FileFilter:="DXF Files (*.dxf), *.dxf", _
                                           Title:="Save DXF File - " & coordinateSystem & " Coordinates")
    
    If fileName <> "False" Then
        fileNum = FreeFile
        Open fileName For Output As #fileNum
        Print #fileNum, dxfContent
        Close #fileNum
        MsgBox "DXF file exported successfully!" & vbCrLf & vbCrLf & _
               "File: " & fileName & vbCrLf & _
               "Coordinate System: " & coordinateSystem & vbCrLf & _
               "Holes Processed: " & (lastRow - 1)
    End If
End Sub

Function BuildDXFHeader(minX As Double, minY As Double, minZ As Double, maxX As Double, maxY As Double, maxZ As Double) As String
    Dim header As String
    header = "999" & vbCrLf & "********************************" & vbCrLf
    header = header & "999" & vbCrLf & "*   DXF File - Entities Only   *" & vbCrLf
    header = header & "999" & vbCrLf & "*        3D Data Format        *" & vbCrLf
    header = header & "999" & vbCrLf & "* from Action Drill and Blast  *" & vbCrLf
    header = header & "999" & vbCrLf & "*     " & Format(Now, "dd-mmm-yyyy hh:mm:ss") & "     *" & vbCrLf
    header = header & "999" & vbCrLf & "********************************" & vbCrLf
    header = header & "0" & vbCrLf & "SECTION" & vbCrLf & "2" & vbCrLf & "HEADER" & vbCrLf
    header = header & "9" & vbCrLf & "$ACADVER" & vbCrLf & "1" & vbCrLf & "AC1009" & vbCrLf
    header = header & "9" & vbCrLf & "$EXTMIN" & vbCrLf
    header = header & "10" & vbCrLf & Format(minX, "0.000") & vbCrLf
    header = header & "20" & vbCrLf & Format(minY, "0.000") & vbCrLf
    header = header & "30" & vbCrLf & Format(minZ, "0.000") & vbCrLf
    header = header & "9" & vbCrLf & "$EXTMAX" & vbCrLf
    header = header & "10" & vbCrLf & Format(maxX, "0.000") & vbCrLf
    header = header & "20" & vbCrLf & Format(maxY, "0.000") & vbCrLf
    header = header & "30" & vbCrLf & Format(maxZ, "0.000") & vbCrLf
    header = header & "0" & vbCrLf & "ENDSEC" & vbCrLf
    BuildDXFHeader = header
End Function

Function BuildDXFTables(layerName As String) As String
    Dim tables As String
    
    ' TABLES section with LAYER and APPID tables
    tables = "0" & vbCrLf & "SECTION" & vbCrLf & "2" & vbCrLf & "TABLES" & vbCrLf
    
    ' LAYER table
    tables = tables & "0" & vbCrLf & "TABLE" & vbCrLf & "2" & vbCrLf & "LAYER" & vbCrLf
    tables = tables & "0" & vbCrLf & "LAYER" & vbCrLf
    tables = tables & "5" & vbCrLf & "2" & vbCrLf
    tables = tables & "2" & vbCrLf & layerName & vbCrLf
    tables = tables & "70" & vbCrLf & "0" & vbCrLf
    tables = tables & "62" & vbCrLf & "7" & vbCrLf ' White color for layer
    tables = tables & "0" & vbCrLf & "ENDTAB" & vbCrLf
    
    ' APPID table
    tables = tables & "0" & vbCrLf & "TABLE" & vbCrLf & "2" & vbCrLf & "APPID" & vbCrLf
    tables = tables & "0" & vbCrLf & "APPID" & vbCrLf
    tables = tables & "2" & vbCrLf & "ACAD" & vbCrLf
    tables = tables & "70" & vbCrLf & "0" & vbCrLf
    tables = tables & "0" & vbCrLf & "APPID" & vbCrLf
    tables = tables & "2" & vbCrLf & "MAPTEK_VULCAN" & vbCrLf
    tables = tables & "70" & vbCrLf & "0" & vbCrLf
    tables = tables & "0" & vbCrLf & "ENDTAB" & vbCrLf
    
    tables = tables & "0" & vbCrLf & "ENDSEC" & vbCrLf
    
    ' BLOCKS section (empty for compatibility)
    tables = tables & "0" & vbCrLf & "SECTION" & vbCrLf & "2" & vbCrLf & "BLOCKS" & vbCrLf
    tables = tables & "0" & vbCrLf & "ENDSEC" & vbCrLf
    
    BuildDXFTables = tables
End Function

Function CreateHolePolyline(ws As Worksheet, row As Long, coordinateSystem As String, layerName As String) As String
    Dim polyline As String
    Dim holeName As String
    Dim collarX As Double, collarY As Double, collarZ As Double
    Dim gradeX As Double, gradeY As Double, gradeZ As Double
    Dim toeX As Double, toeY As Double, toeZ As Double
    Static handleCounter As Long
    
    On Error GoTo ErrorHandler
    
    ' Skip header row or empty rows
    If row = 1 Then
        CreateHolePolyline = ""
        Exit Function
    End If
    
    Dim testCell As String
    testCell = CStr(ws.Cells(row, 4).Value) ' Hole No.
    If Len(Trim(testCell)) = 0 Or testCell = "" Then
        CreateHolePolyline = ""
        Exit Function
    End If
    
    ' Get all values as strings first
    Dim holeNumStr As String, collarXStr As String, collarYStr As String, collarZStr As String
    Dim depthStr As String, bearingStr As String, dipStr As String, subdrillStr As String
    
    holeNumStr = CStr(ws.Cells(row, 4).Value)   ' Column D: Hole No.
    collarXStr = CStr(ws.Cells(row, 1).Value)   ' Column A: Collar Eas/X
    collarYStr = CStr(ws.Cells(row, 2).Value)   ' Column B: Collar Nor/Y
    collarZStr = CStr(ws.Cells(row, 3).Value)   ' Column C: Collar RL/Z
    depthStr = CStr(ws.Cells(row, 6).Value)     ' Column F: Hole Depth
    bearingStr = CStr(ws.Cells(row, 7).Value)   ' Column G: Bearing
    dipStr = CStr(ws.Cells(row, 8).Value)       ' Column H: Dip
    subdrillStr = CStr(ws.Cells(row, 9).Value)  ' Column I: Subdrill
    
    holeName = Trim(holeNumStr) ' Trim to ensure no stray spaces
    Debug.Print "Processing " & coordinateSystem & " row " & row & ", Hole: " & holeName
    
    ' Convert strings to doubles with validation
    If IsNumeric(collarXStr) Then collarX = CDbl(collarXStr) Else GoTo ErrorHandler
    If IsNumeric(collarYStr) Then collarY = CDbl(collarYStr) Else GoTo ErrorHandler
    If IsNumeric(collarZStr) Then collarZ = CDbl(collarZStr) Else GoTo ErrorHandler
    
    Dim holeDepth As Double, bearing As Double, dip As Double, subdrill As Double
    If IsNumeric(depthStr) Then holeDepth = CDbl(depthStr) Else holeDepth = 0
    If IsNumeric(bearingStr) Then bearing = CDbl(bearingStr) Else bearing = 0
    If IsNumeric(dipStr) Then dip = CDbl(dipStr) Else dip = 90
    If IsNumeric(subdrillStr) Then subdrill = CDbl(subdrillStr) Else subdrill = 0
    
    ' Validate bearing and dip
    If dip < 0 Or dip > 90 Then
        Err.Raise vbObjectError + 1000, , "Invalid dip angle: " & dip
    End If
    bearing = bearing Mod 360 ' Normalize bearing
    
    ' Calculate points
    CalculateHolePointsFromBearingDip collarX, collarY, collarZ, holeDepth, bearing, dip, subdrill, _
                                     gradeX, gradeY, gradeZ, toeX, toeY, toeZ
    
    ' Create 3D POLYLINE
    handleCounter = handleCounter + 1
    polyline = "0" & vbCrLf & "POLYLINE" & vbCrLf
    polyline = polyline & "5" & vbCrLf & Hex(handleCounter) & vbCrLf ' Use numeric handle
    polyline = polyline & "8" & vbCrLf & layerName & vbCrLf ' Layer is Blast Name with suffix
    polyline = polyline & "62" & vbCrLf & "140" & vbCrLf ' Red color
    polyline = polyline & "66" & vbCrLf & "140" & vbCrLf ' Vertex follows
    polyline = polyline & "70" & vbCrLf & "8" & vbCrLf ' 3D polyline
    
    ' Add XData for Vulcan
    polyline = polyline & "1001" & vbCrLf & "MAPTEK_VULCAN" & vbCrLf
    polyline = polyline & "1000" & vbCrLf & "VulcanName=" & holeName & vbCrLf
    polyline = polyline & "1000" & vbCrLf & "VulcanGroup=" & vbCrLf
    polyline = polyline & "1000" & vbCrLf & "VulcanValue=0" & vbCrLf
    polyline = polyline & "1000" & vbCrLf & "VulcanDescription=Imported from Excel - ADB" & vbCrLf
    polyline = polyline & "1000" & vbCrLf & "VulcanPrimitive=" & vbCrLf
    polyline = polyline & "1000" & vbCrLf & "VulcanLine=0" & vbCrLf
    polyline = polyline & "1000" & vbCrLf & "VulcanPattern=0" & vbCrLf
    polyline = polyline & "1000" & vbCrLf & "VulcanFeature=" & vbCrLf
    
    ' Collar vertex
    polyline = polyline & "0" & vbCrLf & "VERTEX" & vbCrLf
    polyline = polyline & "5" & vbCrLf & Hex(handleCounter + 1) & vbCrLf
    polyline = polyline & "8" & vbCrLf & layerName & vbCrLf
    polyline = polyline & "62" & vbCrLf & "140" & vbCrLf ' Red color
    polyline = polyline & "10" & vbCrLf & Format(collarX, "0.000") & vbCrLf
    polyline = polyline & "20" & vbCrLf & Format(collarY, "0.000") & vbCrLf
    polyline = polyline & "30" & vbCrLf & Format(collarZ, "0.000") & vbCrLf
    polyline = polyline & "70" & vbCrLf & "32" & vbCrLf ' 3D polyline vertex
    
    ' Grade vertex
    polyline = polyline & "0" & vbCrLf & "VERTEX" & vbCrLf
    polyline = polyline & "5" & vbCrLf & Hex(handleCounter + 2) & vbCrLf
    polyline = polyline & "8" & vbCrLf & layerName & vbCrLf
    polyline = polyline & "62" & vbCrLf & "140" & vbCrLf ' Red color
    polyline = polyline & "10" & vbCrLf & Format(gradeX, "0.000") & vbCrLf
    polyline = polyline & "20" & vbCrLf & Format(gradeY, "0.000") & vbCrLf
    polyline = polyline & "30" & vbCrLf & Format(gradeZ, "0.000") & vbCrLf
    polyline = polyline & "70" & vbCrLf & "32" & vbCrLf ' 3D polyline vertex
    
    ' Toe vertex
    polyline = polyline & "0" & vbCrLf & "VERTEX" & vbCrLf
    polyline = polyline & "5" & vbCrLf & Hex(handleCounter + 3) & vbCrLf
    polyline = polyline & "8" & vbCrLf & layerName & vbCrLf
    polyline = polyline & "62" & vbCrLf & "140" & vbCrLf ' Red color
    polyline = polyline & "10" & vbCrLf & Format(toeX, "0.000") & vbCrLf
    polyline = polyline & "20" & vbCrLf & Format(toeY, "0.000") & vbCrLf
    polyline = polyline & "30" & vbCrLf & Format(toeZ, "0.000") & vbCrLf
    polyline = polyline & "70" & vbCrLf & "32" & vbCrLf ' 3D polyline vertex
    
    ' SEQEND with layer
    polyline = polyline & "0" & vbCrLf & "SEQEND" & vbCrLf
    polyline = polyline & "8" & vbCrLf & layerName & vbCrLf
    
    CreateHolePolyline = polyline
    Exit Function
    
ErrorHandler:
    Debug.Print "Error in CreateHolePolyline for row " & row & ": " & Err.Description
    CreateHolePolyline = ""
End Function

Function CalculateHolePointsFromBearingDip(collarX As Double, collarY As Double, collarZ As Double, _
                                          holeDepth As Double, bearing As Double, dip As Double, subdrill As Double, _
                                          ByRef gradeX As Double, ByRef gradeY As Double, ByRef gradeZ As Double, _
                                          ByRef toeX As Double, ByRef toeY As Double, ByRef toeZ As Double)
    
    Dim bearingRad As Double, dipRad As Double
    Dim plannedDepth As Double
    Dim deltaX As Double, deltaY As Double, deltaZ As Double
    
    ' Convert to radians
    bearingRad = bearing * 3.14159265359 / 180
    dipRad = dip * 3.14159265359 / 180
    
    ' Calculate planned depth (without subdrill)
    plannedDepth = holeDepth - subdrill
    
    ' Calculate displacement components
    deltaX = Sin(bearingRad) * Cos(dipRad)
    deltaY = Cos(bearingRad) * Cos(dipRad)
    deltaZ = -Sin(dipRad)
    
    ' Debug the components
    Debug.Print "Bearing: " & bearing & "° (" & Format(bearingRad, "0.000") & " rad)"
    Debug.Print "Dip: " & dip & "° (" & Format(dipRad, "0.000") & " rad)"
    Debug.Print "Components: dX=" & Format(deltaX, "0.000") & ", dY=" & Format(deltaY, "0.000") & ", dZ=" & Format(deltaZ, "0.000")
    
    ' Calculate grade point
    gradeX = collarX + plannedDepth * deltaX
    gradeY = collarY + plannedDepth * deltaY
    gradeZ = collarZ + plannedDepth * deltaZ
    
    ' Calculate toe point
    toeX = collarX + holeDepth * deltaX
    toeY = collarY + holeDepth * deltaY
    toeZ = collarZ + holeDepth * deltaZ
    
    ' Debug output
    Debug.Print "INPUT: Bearing=" & bearing & "° Dip=" & dip & "° Depth=" & holeDepth & "m Subdrill=" & subdrill & "m"
    Debug.Print "Collar: E=" & Format(collarX, "0.00") & " N=" & Format(collarY, "0.00") & " Z=" & Format(collarZ, "0.00")
    Debug.Print "Grade:  E=" & Format(gradeX, "0.00") & " N=" & Format(gradeY, "0.00") & " Z=" & Format(gradeZ, "0.00")
    Debug.Print "Toe:    E=" & Format(toeX, "0.00") & " N=" & Format(toeY, "0.00") & " Z=" & Format(toeZ, "0.00")
    Debug.Print "Z Change: Grade=" & Format(gradeZ - collarZ, "0.00") & "m, Toe=" & Format(toeZ - collarZ, "0.00") & "m"
    Debug.Print "---"
End Function

Sub ExportSelectedHolesToDXF()
    Dim coordinateSystem As String
    Dim ws As Worksheet
    Dim blastName As String
    Dim layerName As String
    Dim selectedRange As Range
    Dim cell As Range
    Dim dxfContent As String
    Dim fileName As String
    Dim fileNum As Integer
    Dim response As VbMsgBoxResult
    Dim holeCount As Long
    Dim minX As Double, minY As Double, minZ As Double
    Dim maxX As Double, maxY As Double, maxZ As Double
    
    ' Get Blast Name from DATA!H4
    On Error Resume Next
    blastName = ThisWorkbook.Worksheets("DATA").Cells(4, 8).Value
    If blastName = "" Then
        MsgBox "Blast Name not found in DATA!H4!"
        Exit Sub
    End If
    On Error GoTo 0
    
    ' Check if user has selected a range
    Set selectedRange = Selection
    If selectedRange Is Nothing Then
        MsgBox "Please select the range of holes to export!"
        Exit Sub
    End If
    
    ' Prompt user to select coordinate system
    response = MsgBox("Select coordinate system for selected holes:" & vbCrLf & vbCrLf & _
                     "YES = MGA (Map Grid Australia)" & vbCrLf & _
                     "NO = LOC (Local Coordinates)", _
                     vbYesNoCancel + vbQuestion, "Select Coordinate System")
    
    If response = vbCancel Then
        Exit Sub
    ElseIf response = vbYes Then
        coordinateSystem = "MGA"
        Set ws = ThisWorkbook.Worksheets("MGA_DATA")
        layerName = blastName & "_MGA"
    Else
        coordinateSystem = "LOC"
        Set ws = ThisWorkbook.Worksheets("LOC_DATA")
        layerName = blastName & "_LOCAL"
    End If
    
    ' Validate selection is in the correct worksheet
    If selectedRange.Worksheet.Name <> ws.Name Then
        MsgBox "Selection must be in the " & ws.Name & " worksheet!"
        Exit Sub
    End If
    
    ' Calculate approximate extents for HEADER
    minX = 1E+308: minY = 1E+308: minZ = 1E+308
    maxX = -1E+308: maxY = -1E+308: maxZ = -1E+308
    For Each cell In selectedRange.Rows
        If cell.row > 1 Then
            Dim checkCell As String
            checkCell = CStr(ws.Cells(cell.row, 4).Value)
            If Len(Trim(checkCell)) > 0 And checkCell <> "" Then
                If IsNumeric(ws.Cells(cell.row, 1).Value) Then
                    minX = WorksheetFunction.Min(minX, CDbl(ws.Cells(cell.row, 1).Value))
                    maxX = WorksheetFunction.Max(maxX, CDbl(ws.Cells(cell.row, 1).Value))
                End If
                If IsNumeric(ws.Cells(cell.row, 2).Value) Then
                    minY = WorksheetFunction.Min(minY, CDbl(ws.Cells(cell.row, 2).Value))
                    maxY = WorksheetFunction.Max(maxY, CDbl(ws.Cells(cell.row, 2).Value))
                End If
                If IsNumeric(ws.Cells(cell.row, 3).Value) Then
                    minZ = WorksheetFunction.Min(minZ, CDbl(ws.Cells(cell.row, 3).Value))
                    maxZ = WorksheetFunction.Max(maxZ, CDbl(ws.Cells(cell.row, 3).Value))
                End If
            End If
        End If
    Next cell
    
    ' Build DXF content
    dxfContent = BuildDXFHeader(minX, minY, minZ, maxX, maxY, maxZ)
    dxfContent = dxfContent & BuildDXFTables(layerName)
    dxfContent = dxfContent & "0" & vbCrLf & "SECTION" & vbCrLf & "2" & vbCrLf & "ENTITIES" & vbCrLf
    
    ' Process selected rows
    holeCount = 0
    For Each cell In selectedRange.Rows
        If cell.row > 1 Then
            Dim checkCell As String
            checkCell = CStr(ws.Cells(cell.row, 4).Value) ' Hole No.
            If Len(Trim(checkCell)) > 0 And checkCell <> "" Then
                On Error GoTo SkipSelectedRow
                dxfContent = dxfContent & CreateHolePolyline(ws, cell.row, coordinateSystem, layerName)
                holeCount = holeCount + 1
                GoTo NextSelectedRow
SkipSelectedRow:
                Debug.Print "Error processing selected row " & cell.row & ": " & Err.Description
                Resume NextSelectedRow
NextSelectedRow:
            End If
        End If
    Next cell
    
    ' Close DXF file
    dxfContent = dxfContent & "0" & vbCrLf & "ENDSEC" & vbCrLf & "0" & vbCrLf & "EOF" & vbCrLf
    
    ' Save to file
    fileName = Application.GetSaveAsFilename(initialFileName:="Selected_Holes_" & coordinateSystem & "_Export.dxf", _
                                           FileFilter:="DXF Files (*.dxf), *.dxf", _
                                           Title:="Save Selected Holes DXF - " & coordinateSystem)
    
    If fileName <> "False" Then
        fileNum = FreeFile
        Open fileName For Output As #fileNum
        Print #fileNum, dxfContent
        Close #fileNum
        MsgBox "Selected holes exported successfully!" & vbCrLf & vbCrLf & _
               "File: " & fileName & vbCrLf & _
               "Coordinate System: " & coordinateSystem & vbCrLf & _
               "Holes Processed: " & holeCount
    End If
End Sub

