Attribute VB_Name = "CBLAST"
Sub ExportCBLASTFile()
  
    ' Define file path for the output CSV
    Dim filePath As String
    Dim blastName As String
    blastName = ThisWorkbook.Worksheets("DATA").Range("H4").Value
    If Trim(blastName) = "" Then blastName = "DefaultBlast" ' Fallback if H4 is empty
    
    filePath = Application.GetSaveAsFilename( _
        initialFileName:="CBLAST_" & blastName & ".csv", _
        FileFilter:="CSV Files (*.csv), *.csv", _
        Title:="Save CBLAST File")
    If filePath = "False" Then Exit Sub

    ' Open the file for writing
    Dim fileNum As Integer
    fileNum = FreeFile
    Open filePath For Output As #fileNum

    ' Reference to the DATA sheet
    Dim wsData As Worksheet
    Set wsData = ThisWorkbook.Sheets("DATA")
    Dim wsLists As Worksheet
    Set wsLists = ThisWorkbook.Sheets("LISTS")

    ' Variables for looping through data
    Dim lastRow As Long
    Dim i As Long
    Dim holeID As String
    Dim diameter As Double
    Dim bearing As Double
    Dim dip As Double
    Dim angle As Double
    Dim outputLine As String
    Dim depth As Double
    Dim stemming As String
    Dim detonatorDepth As Double
    Dim easting As String
    Dim northing As String
    Dim elevation As String
    Dim chargeLength As String
    Dim productType As String
    Dim primerType As String
    Dim deckProduct As String
    Dim deckLength As String
        Dim timeDelay As Variant
    
    ' Get the last row of data based on column I (Blast Hole ID, column 9)
    lastRow = wsData.Cells(wsData.Rows.Count, 9).End(xlUp).row
    
    ' Debug: Show the detected last row to confirm
    MsgBox "Last row detected: " & lastRow
    
    ' Loop through each row in the DATA sheet (starting from row 2 to skip headers)
    For i = 4 To lastRow
        ' Assign values (no validation)
        holeID = wsData.Cells(i, 9).Value ' Blast_Hole_ID (Column I)
        diameter = (wsData.Cells(i, 11).Value) / 1000 'Diameter (Column K)
        bearing = wsData.Cells(i, 15).Value ' Bearing (Column O)
        dip = wsData.Cells(i, 10).Value ' Dip (Column J)
        angle = 90 - dip ' Convert dip to angle
        ' If angle is negative, set to 0
        If angle < 0 Then angle = 0
        subdrill = wsData.Cells(i, 13).Value ' Subdrill (Column M)
        easting = wsData.Cells(i, 18).Value ' Collar_X (Column R)
        northing = wsData.Cells(i, 19).Value ' Collar_Y (Column S)
        elevation = wsData.Cells(i, 20).Value ' CH RL (Elevation, Column T)
        depth = CDbl(wsData.Cells(i, 12).Value) ' Drill_Length (Depth, Column L)
        stemming = wsData.Cells(i, 24).Value ' Stemming (Column X)
        detonatorDepth = depth ' Calculate detonator depth - Just use hole depth otherwise it risks det being out of product.
        stemmingType = wsData.Cells(i, 28).Value ' Stemming Type (Column AB)
        productType = wsData.Cells(i, 29).Value ' Product Type (Column AC)
        chargeLength = wsData.Cells(i, 33).Value ' Charge_Length (Column AG)
        primerType = wsData.Cells(i, 27).Value ' Primer Type (Column AA)
        detonatorType = wsData.Cells(i, 26).Value ' Detonator Type (Column Z)
        timeDelay = wsData.Cells(i, 25).Value ' Time column (Column Y)

        ' Escape commas in string fields
        If InStr(productType, ",") > 0 Then productType = """" & productType & """"
        If InStr(primerType, ",") > 0 Then primerType = """" & primerType & """"

        ' Determine deck product and length
        deckProduct = "Air"
        possibleExpProducts = wsLists.Range("Q3:Q18").Value ' Possible explosive products
        possibleStemProducts = wsLists.Range("U3:U6").Value ' Possible stemming products
        deckLength = stemming
        If UCase(Trim(productType)) = "DO NOT CHARGE" Then
            deckProduct = "Do Not Charge"
            deckLength = depth
        End If

        ' Write HOLE record
        outputLine = "HOLE,," & holeID & "," & easting & "," & northing & "," & elevation & "," & bearing & "," & angle & "," & depth & "," & diameter & ",,,"
        Print #fileNum, outputLine

        ' Write PRODUCT record
        If UCase(Trim(productType)) = "DO NOT CHARGE" Then
        'No Explosives
            outputLine = "PRODUCT,," & holeID & ",1," & stemmingType & "," & deckLength & ",,,,,,,,"
        Else
        'Normal Blast hole two deck one Stemming and one Explosive.
            outputLine = "PRODUCT,," & holeID & ",2," & stemmingType & "," & stemming & "," & productType & "," & chargeLength & ",,,,,,"
        End If
        Print #fileNum, outputLine

        ' Write DETONATOR record
        If UCase(Trim(productType)) = "DO NOT CHARGE" Then
            'No detonator
            outputLine = "DETONATOR,," & holeID & ",0,,,,,,,,,,,"
        Else
            If IsNumeric(timeDelay) And timeDelay <> "" Then
                outputLine = "DETONATOR,," & holeID & ",1," & detonatorType & "," & detonatorDepth & "," & timeDelay & ",,,,,,,"
            Else
                outputLine = "DETONATOR,," & holeID & ",1," & detonatorType & "," & detonatorDepth & ",0,,,,,,,"
            End If
        End If
        Print #fileNum, outputLine

        ' Write STRATA record
        outputLine = "STRATA,," & holeID & ",0,,,,,,,,,,,"
        Print #fileNum, outputLine
    Next i

    ' Close the file
    Close #fileNum
End Sub


