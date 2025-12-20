Attribute VB_Name = "CALCSDOB"
Option Explicit

Private Declare PtrSafe Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
Dim myProgressForm As frmProgress

Sub CalculateStemmingForTargetSDoB()
    Dim ws As Worksheet
    Dim row As Long
    Dim targetSDoB As Double
    Dim startTime As Double
    Dim elapsedTime As Double
    Dim processedCount As Long
    Dim totalIterations As Long
    Dim rowsWithData As Long
    Dim lastPromptTime As Double
    Dim abortProcess As Boolean
    Dim originalStemming() As Double
    
    Set ws = ActiveSheet
    targetSDoB = 1.5
    abortProcess = False
    
    Application.StatusBar = "Counting rows with data..."
    rowsWithData = 0
    For row = 4 To 2999
        If ws.Cells(row, "L").Value <> "" And IsNumeric(ws.Cells(row, "L").Value) And ws.Cells(row, "L").Value > 0 Then
            rowsWithData = rowsWithData + 1
        End If
    Next row
    Application.StatusBar = False
    
    If rowsWithData = 0 Then
        MsgBox "No valid data found (rows 4-2999 where column L is not empty and numeric)", vbInformation
        Exit Sub
    End If
    
    If MsgBox("Ready to calculate stemming for " & rowsWithData & " rows" & vbCrLf & _
              "Target SDoB: " & targetSDoB & vbCrLf & _
              "Start Stemming: 1.5m" & vbCrLf & _
              "Tolerance: 100mm" & vbCrLf & _
              "Continue?", vbYesNo + vbQuestion) = vbNo Then Exit Sub
    
    ReDim originalStemming(4 To 2999)
    For row = 4 To 2999
        originalStemming(row) = ws.Cells(row, "X").Value
    Next row
    
    Set myProgressForm = New frmProgress
    myProgressForm.lblTotal.Caption = "Total Rows: " & rowsWithData
    myProgressForm.Show
    
    startTime = Timer
    processedCount = 0
    totalIterations = 0
    
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual
    
    For row = 4 To 2999
        If myProgressForm.cmdCancelFlag Then ' Updated to match UserForm property
            Debug.Print "Cancel request detected at row " & row
            abortProcess = True
            Exit For
        End If
        
        If ws.Cells(row, "L").Value <> "" And IsNumeric(ws.Cells(row, "L").Value) And ws.Cells(row, "L").Value > 0 Then
            processedCount = processedCount + 1
            Dim result As Variant
            Dim iterations As Long
            
            result = CalculateStemmingIterative(targetSDoB, row, ws, iterations)
            totalIterations = totalIterations + iterations
            
            If IsArray(result) And result(0) > 0 Then
                ws.Cells(row, "BG").Value = result(0)
                ws.Cells(row, "BH").Value = result(1)
            Else
                ws.Cells(row, "BG").Value = ""
                ws.Cells(row, "BH").Value = ""
            End If
            
            With myProgressForm
                .lblRow.Caption = "Current Row: " & row
                .lblPercent.Caption = "Progress: " & Format((processedCount / rowsWithData) * 100, "0") & "%"
                elapsedTime = Timer - startTime
                .lblTime.Caption = "Elapsed Time: " & Format(elapsedTime, "0") & "s"
                DoEvents
            End With
        End If
    Next row
    
    For row = 4 To 2999
        ws.Cells(row, "X").Value = originalStemming(row)
    Next row
    
    Unload myProgressForm
    Set myProgressForm = Nothing
    
    Application.Calculation = xlCalculationAutomatic
    Application.ScreenUpdating = True
    Application.StatusBar = False
    
    elapsedTime = Timer - startTime
    If abortProcess Then
        MsgBox "Process aborted!" & vbCrLf & _
               "Rows: " & processedCount & "/" & rowsWithData & vbCrLf & _
               "Iterations: " & totalIterations & vbCrLf & _
               "Time: " & Format(elapsedTime, "0.0") & "s", vbInformation
    Else
        MsgBox "Complete!" & vbCrLf & _
               "Rows: " & processedCount & vbCrLf & _
               "Iterations: " & totalIterations & vbCrLf & _
               "Avg/row: " & Format(totalIterations / IIf(processedCount = 0, 1, processedCount), "0.0") & vbCrLf & _
               "Time: " & Format(elapsedTime, "0.0") & "s", vbInformation
    End If
End Sub

Function CalculateStemmingIterative(targetSDoB As Double, row As Long, ws As Worksheet, ByRef iterationCount As Long) As Variant
    Dim testStemming As Double
    Dim chargeLength As Double
    Dim contribution As Double
    Dim currentSDoB As Double
    Dim minStemming As Double
    Dim iterationResult As Long
    Dim chargeMass As Double
    Dim diameter_m As Double
    Dim drillLength As Double
    Dim maxIterations As Long
    
    iterationCount = 0
    minStemming = -1
    iterationResult = 0
    
    If ws.Cells(row, "K").Value <= 0 Or ws.Cells(row, "L").Value <= 0 Or ws.Cells(row, "AF").Value <= 0 Then
        CalculateStemmingIterative = Array(-1, 0)
        Exit Function
    End If
    
    drillLength = ws.Cells(row, "L").Value
    diameter_m = ws.Cells(row, "K").Value / 1000
    maxIterations = Int((drillLength - 0.2) / 0.1) + 1
    
    ' modify the test stemming value to start stemming at a value.
    testStemming = 1.5
    Do While testStemming <= drillLength - 0.1 And iterationCount < maxIterations
        iterationCount = iterationCount + 1
        testStemming = Round(testStemming, 1)
        
        ws.Cells(row, "X").Value = testStemming
        DoEvents
        Application.Calculation = xlCalculationAutomatic
        ws.Calculate
        Application.Calculation = xlCalculationManual
        
        chargeLength = ws.Cells(row, "AG").Value
        chargeMass = ws.Cells(row, "AH").Value
        currentSDoB = ws.Cells(row, "AM").Value
        
        If chargeLength <= 0 Then Exit Do
        
        contribution = IIf(Round(chargeLength, 1) >= diameter_m * 10, diameter_m * 10, Round(chargeLength, 1))
        
        If row <= 13 Then
            Debug.Print "Row: " & row & ", Iteration: " & iterationCount & ", Stemming: " & testStemming & _
                       ", Charge Length: " & chargeLength & ", Charge Mass: " & chargeMass & _
                       ", Contribution: " & contribution & ", SDoB: " & currentSDoB
        End If
        
        If IsNumeric(currentSDoB) And currentSDoB >= targetSDoB And currentSDoB > 0 Then
            minStemming = testStemming
            iterationResult = iterationCount
            Exit Do
        End If
        
        testStemming = testStemming + 0.1
    Loop
    
    If minStemming = -1 Then
        minStemming = Round(drillLength * 0.85, 1)
        iterationResult = 0
    End If
    
    CalculateStemmingIterative = Array(minStemming, iterationResult)
End Function



