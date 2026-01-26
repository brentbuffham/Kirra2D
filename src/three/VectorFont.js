/**
 * VectorFont.js - Hershey Simplex Vector Font for 2D Canvas, 3D Three.js, and SVG/Print
 * 
 * Based on the public domain Hershey Fonts created by Dr. A.V. Hershey
 * at the U.S. National Bureau of Standards in 1967.
 * 
 * This module provides text rendering as line segments for:
 * - 2D Canvas: ctx.moveTo/lineTo paths
 * - 3D Three.js: THREE.LineSegments geometry
 * - SVG/Print: SVG path elements
 * 
 * Benefits over traditional text:
 * - Consistent appearance across 2D, 3D, and print
 * - Infinite zoom quality (vector)
 * - Batchable with other line geometry (performance)
 * - Exports as editable polylines (CAD compatible)
 */

// Step 1) Hershey Simplex font data
// Format: [numVertices, width, ...coordinates]
// Coordinates are (x, y) pairs where (-1, -1) means pen up
// ASCII characters 32 (space) to 126 (~)
const HERSHEY_SIMPLEX = {
    // ASCII 32 - Space
    32: { width: 16, strokes: [] },
    
    // ASCII 33 - !
    33: { width: 10, strokes: [
        [[5,21], [5,7]],
        [[5,2], [4,1], [5,0], [6,1], [5,2]]
    ]},
    
    // ASCII 34 - "
    34: { width: 16, strokes: [
        [[4,21], [4,14]],
        [[12,21], [12,14]]
    ]},
    
    // ASCII 35 - #
    35: { width: 21, strokes: [
        [[11,25], [4,-7]],
        [[17,25], [10,-7]],
        [[4,12], [18,12]],
        [[3,6], [17,6]]
    ]},
    
    // ASCII 36 - $
    36: { width: 20, strokes: [
        [[8,25], [8,-4]],
        [[12,25], [12,-4]],
        [[17,18], [15,20], [12,21], [8,21], [5,20], [3,18], [3,16], [4,14], [5,13], [7,12], [13,10], [15,9], [16,8], [17,6], [17,3], [15,1], [12,0], [8,0], [5,1], [3,3]]
    ]},
    
    // ASCII 37 - %
    37: { width: 24, strokes: [
        [[21,21], [3,0]],
        [[8,21], [10,19], [10,17], [9,15], [7,14], [5,14], [3,16], [3,18], [4,20], [6,21], [8,21], [10,20], [13,19], [16,19], [19,20], [21,21]],
        [[17,7], [15,6], [14,4], [14,2], [16,0], [18,0], [20,1], [21,3], [21,5], [19,7], [17,7]]
    ]},
    
    // ASCII 38 - &
    38: { width: 26, strokes: [
        [[23,12], [23,13], [22,14], [21,14], [20,13], [19,11], [17,6], [15,3], [13,1], [11,0], [7,0], [5,1], [4,2], [3,4], [3,6], [4,8], [5,9], [12,13], [13,14], [14,16], [14,18], [13,20], [11,21], [9,20], [8,18], [8,16], [9,13], [11,10], [16,3], [18,1], [20,0], [22,0], [23,1], [23,2]]
    ]},
    
    // ASCII 39 - '
    39: { width: 10, strokes: [
        [[5,19], [4,20], [5,21], [6,20], [6,18], [5,16], [4,15]]
    ]},
    
    // ASCII 40 - (
    40: { width: 14, strokes: [
        [[11,25], [9,23], [7,20], [5,16], [4,11], [4,7], [5,2], [7,-2], [9,-5], [11,-7]]
    ]},
    
    // ASCII 41 - )
    41: { width: 14, strokes: [
        [[3,25], [5,23], [7,20], [9,16], [10,11], [10,7], [9,2], [7,-2], [5,-5], [3,-7]]
    ]},
    
    // ASCII 42 - *
    42: { width: 16, strokes: [
        [[8,21], [8,9]],
        [[3,18], [13,12]],
        [[13,18], [3,12]]
    ]},
    
    // ASCII 43 - +
    43: { width: 26, strokes: [
        [[13,18], [13,0]],
        [[4,9], [22,9]]
    ]},
    
    // ASCII 44 - ,
    44: { width: 10, strokes: [
        [[6,1], [5,0], [4,1], [5,2], [6,1], [6,-1], [5,-3], [4,-4]]
    ]},
    
    // ASCII 45 - -
    45: { width: 26, strokes: [
        [[4,9], [22,9]]
    ]},
    
    // ASCII 46 - .
    46: { width: 10, strokes: [
        [[5,2], [4,1], [5,0], [6,1], [5,2]]
    ]},
    
    // ASCII 47 - /
    47: { width: 22, strokes: [
        [[20,25], [2,-7]]
    ]},
    
    // ASCII 48 - 0
    48: { width: 20, strokes: [
        [[9,21], [6,20], [4,17], [3,12], [3,9], [4,4], [6,1], [9,0], [11,0], [14,1], [16,4], [17,9], [17,12], [16,17], [14,20], [11,21], [9,21]]
    ]},
    
    // ASCII 49 - 1
    49: { width: 20, strokes: [
        [[6,17], [8,18], [11,21], [11,0]]
    ]},
    
    // ASCII 50 - 2
    50: { width: 20, strokes: [
        [[4,16], [4,17], [5,19], [6,20], [8,21], [12,21], [14,20], [15,19], [16,17], [16,15], [15,13], [13,10], [3,0], [17,0]]
    ]},
    
    // ASCII 51 - 3
    51: { width: 20, strokes: [
        [[5,21], [16,21], [10,13], [13,13], [15,12], [16,11], [17,8], [17,6], [16,3], [14,1], [11,0], [8,0], [5,1], [4,2], [3,4]]
    ]},
    
    // ASCII 52 - 4
    52: { width: 20, strokes: [
        [[13,21], [3,7], [18,7]],
        [[13,21], [13,0]]
    ]},
    
    // ASCII 53 - 5
    53: { width: 20, strokes: [
        [[15,21], [5,21], [4,12], [5,13], [8,14], [11,14], [14,13], [16,11], [17,8], [17,6], [16,3], [14,1], [11,0], [8,0], [5,1], [4,2], [3,4]]
    ]},
    
    // ASCII 54 - 6
    54: { width: 20, strokes: [
        [[16,18], [15,20], [12,21], [10,21], [7,20], [5,17], [4,12], [4,7], [5,3], [7,1], [10,0], [11,0], [14,1], [16,3], [17,6], [17,7], [16,10], [14,12], [11,13], [10,13], [7,12], [5,10], [4,7]]
    ]},
    
    // ASCII 55 - 7
    55: { width: 20, strokes: [
        [[17,21], [7,0]],
        [[3,21], [17,21]]
    ]},
    
    // ASCII 56 - 8 (single continuous stroke!)
    56: { width: 20, strokes: [
        [[8,21], [5,20], [4,18], [4,16], [5,14], [7,13], [11,12], [14,11], [16,9], [17,7], [17,4], [16,2], [15,1], [12,0], [8,0], [5,1], [4,2], [3,4], [3,7], [4,9], [6,11], [9,12], [13,13], [15,14], [16,16], [16,18], [15,20], [12,21], [8,21]]
    ]},
    
    // ASCII 57 - 9
    57: { width: 20, strokes: [
        [[16,14], [15,11], [13,9], [10,8], [9,8], [6,9], [4,11], [3,14], [3,15], [4,18], [6,20], [9,21], [10,21], [13,20], [15,18], [16,14], [16,9], [15,4], [13,1], [10,0], [8,0], [5,1], [4,3]]
    ]},
    
    // ASCII 58 - :
    58: { width: 10, strokes: [
        [[5,14], [4,13], [5,12], [6,13], [5,14]],
        [[5,2], [4,1], [5,0], [6,1], [5,2]]
    ]},
    
    // ASCII 59 - ;
    59: { width: 10, strokes: [
        [[5,14], [4,13], [5,12], [6,13], [5,14]],
        [[6,1], [5,0], [4,1], [5,2], [6,1], [6,-1], [5,-3], [4,-4]]
    ]},
    
    // ASCII 60 - <
    60: { width: 24, strokes: [
        [[20,18], [4,9], [20,0]]
    ]},
    
    // ASCII 61 - =
    61: { width: 26, strokes: [
        [[4,12], [22,12]],
        [[4,6], [22,6]]
    ]},
    
    // ASCII 62 - >
    62: { width: 24, strokes: [
        [[4,18], [20,9], [4,0]]
    ]},
    
    // ASCII 63 - ?
    63: { width: 18, strokes: [
        [[3,16], [3,17], [4,19], [5,20], [7,21], [11,21], [13,20], [14,19], [15,17], [15,15], [14,13], [13,12], [9,10], [9,7]],
        [[9,2], [8,1], [9,0], [10,1], [9,2]]
    ]},
    
    // ASCII 64 - @
    64: { width: 27, strokes: [
        [[18,13], [17,15], [15,16], [12,16], [10,15], [9,14], [8,11], [8,8], [9,6], [11,5], [14,5], [16,6], [17,8]],
        [[12,16], [10,14], [9,11], [9,8], [10,6], [11,5]],
        [[18,16], [17,8], [17,6], [19,5], [21,5], [23,7], [24,10], [24,12], [23,15], [22,17], [20,19], [18,20], [15,21], [12,21], [9,20], [7,19], [5,17], [4,15], [3,12], [3,9], [4,6], [5,4], [7,2], [9,1], [12,0], [15,0], [18,1], [20,2], [21,3]],
        [[19,16], [18,8], [18,6], [19,5]]
    ]},
    
    // ASCII 65 - A
    65: { width: 18, strokes: [
        [[9,21], [1,0]],
        [[9,21], [17,0]],
        [[4,7], [14,7]]
    ]},
    
    // ASCII 66 - B
    66: { width: 21, strokes: [
        [[4,21], [4,0]],
        [[4,21], [13,21], [16,20], [17,19], [18,17], [18,15], [17,13], [16,12], [13,11]],
        [[4,11], [13,11], [16,10], [17,9], [18,7], [18,4], [17,2], [16,1], [13,0], [4,0]]
    ]},
    
    // ASCII 67 - C
    67: { width: 21, strokes: [
        [[18,16], [17,18], [15,20], [13,21], [9,21], [7,20], [5,18], [4,16], [3,13], [3,8], [4,5], [5,3], [7,1], [9,0], [13,0], [15,1], [17,3], [18,5]]
    ]},
    
    // ASCII 68 - D
    68: { width: 21, strokes: [
        [[4,21], [4,0]],
        [[4,21], [11,21], [14,20], [16,18], [17,16], [18,13], [18,8], [17,5], [16,3], [14,1], [11,0], [4,0]]
    ]},
    
    // ASCII 69 - E
    69: { width: 19, strokes: [
        [[4,21], [4,0]],
        [[4,21], [17,21]],
        [[4,11], [12,11]],
        [[4,0], [17,0]]
    ]},
    
    // ASCII 70 - F
    70: { width: 18, strokes: [
        [[4,21], [4,0]],
        [[4,21], [17,21]],
        [[4,11], [12,11]]
    ]},
    
    // ASCII 71 - G
    71: { width: 21, strokes: [
        [[18,16], [17,18], [15,20], [13,21], [9,21], [7,20], [5,18], [4,16], [3,13], [3,8], [4,5], [5,3], [7,1], [9,0], [13,0], [15,1], [17,3], [18,5], [18,8]],
        [[13,8], [18,8]]
    ]},
    
    // ASCII 72 - H
    72: { width: 22, strokes: [
        [[4,21], [4,0]],
        [[18,21], [18,0]],
        [[4,11], [18,11]]
    ]},
    
    // ASCII 73 - I
    73: { width: 8, strokes: [
        [[4,21], [4,0]]
    ]},
    
    // ASCII 74 - J
    74: { width: 16, strokes: [
        [[12,21], [12,5], [11,2], [10,1], [8,0], [6,0], [4,1], [3,2], [2,5], [2,7]]
    ]},
    
    // ASCII 75 - K
    75: { width: 21, strokes: [
        [[4,21], [4,0]],
        [[18,21], [4,7]],
        [[9,12], [18,0]]
    ]},
    
    // ASCII 76 - L
    76: { width: 17, strokes: [
        [[4,21], [4,0]],
        [[4,0], [16,0]]
    ]},
    
    // ASCII 77 - M
    77: { width: 24, strokes: [
        [[4,21], [4,0]],
        [[4,21], [12,0]],
        [[20,21], [12,0]],
        [[20,21], [20,0]]
    ]},
    
    // ASCII 78 - N
    78: { width: 22, strokes: [
        [[4,21], [4,0]],
        [[4,21], [18,0]],
        [[18,21], [18,0]]
    ]},
    
    // ASCII 79 - O
    79: { width: 22, strokes: [
        [[9,21], [7,20], [5,18], [4,16], [3,13], [3,8], [4,5], [5,3], [7,1], [9,0], [13,0], [15,1], [17,3], [18,5], [19,8], [19,13], [18,16], [17,18], [15,20], [13,21], [9,21]]
    ]},
    
    // ASCII 80 - P
    80: { width: 21, strokes: [
        [[4,21], [4,0]],
        [[4,21], [13,21], [16,20], [17,19], [18,17], [18,14], [17,12], [16,11], [13,10], [4,10]]
    ]},
    
    // ASCII 81 - Q
    81: { width: 22, strokes: [
        [[9,21], [7,20], [5,18], [4,16], [3,13], [3,8], [4,5], [5,3], [7,1], [9,0], [13,0], [15,1], [17,3], [18,5], [19,8], [19,13], [18,16], [17,18], [15,20], [13,21], [9,21]],
        [[12,4], [18,-2]]
    ]},
    
    // ASCII 82 - R
    82: { width: 21, strokes: [
        [[4,21], [4,0]],
        [[4,21], [13,21], [16,20], [17,19], [18,17], [18,15], [17,13], [16,12], [13,11], [4,11]],
        [[11,11], [18,0]]
    ]},
    
    // ASCII 83 - S
    83: { width: 20, strokes: [
        [[17,18], [15,20], [12,21], [8,21], [5,20], [3,18], [3,16], [4,14], [5,13], [7,12], [13,10], [15,9], [16,8], [17,6], [17,3], [15,1], [12,0], [8,0], [5,1], [3,3]]
    ]},
    
    // ASCII 84 - T
    84: { width: 16, strokes: [
        [[8,21], [8,0]],
        [[1,21], [15,21]]
    ]},
    
    // ASCII 85 - U
    85: { width: 22, strokes: [
        [[4,21], [4,6], [5,3], [7,1], [10,0], [12,0], [15,1], [17,3], [18,6], [18,21]]
    ]},
    
    // ASCII 86 - V
    86: { width: 18, strokes: [
        [[1,21], [9,0]],
        [[17,21], [9,0]]
    ]},
    
    // ASCII 87 - W
    87: { width: 24, strokes: [
        [[2,21], [7,0]],
        [[12,21], [7,0]],
        [[12,21], [17,0]],
        [[22,21], [17,0]]
    ]},
    
    // ASCII 88 - X
    88: { width: 20, strokes: [
        [[3,21], [17,0]],
        [[17,21], [3,0]]
    ]},
    
    // ASCII 89 - Y
    89: { width: 18, strokes: [
        [[1,21], [9,11], [9,0]],
        [[17,21], [9,11]]
    ]},
    
    // ASCII 90 - Z
    90: { width: 20, strokes: [
        [[17,21], [3,0]],
        [[3,21], [17,21]],
        [[3,0], [17,0]]
    ]},
    
    // ASCII 91 - [
    91: { width: 14, strokes: [
        [[4,25], [4,-7]],
        [[5,25], [5,-7]],
        [[4,25], [11,25]],
        [[4,-7], [11,-7]]
    ]},
    
    // ASCII 92 - \
    92: { width: 14, strokes: [
        [[0,21], [14,-3]]
    ]},
    
    // ASCII 93 - ]
    93: { width: 14, strokes: [
        [[9,25], [9,-7]],
        [[10,25], [10,-7]],
        [[3,25], [10,25]],
        [[3,-7], [10,-7]]
    ]},
    
    // ASCII 94 - ^
    94: { width: 16, strokes: [
        [[6,15], [8,18], [10,15]],
        [[3,12], [8,17], [13,12]],
        [[8,17], [8,0]]
    ]},
    
    // ASCII 95 - _
    95: { width: 16, strokes: [
        [[0,-2], [16,-2]]
    ]},
    
    // ASCII 96 - `
    96: { width: 10, strokes: [
        [[6,21], [5,20], [4,18], [4,16], [5,15], [6,16], [5,17]]
    ]},
    
    // ASCII 97 - a
    97: { width: 19, strokes: [
        [[15,14], [15,0]],
        [[15,11], [13,13], [11,14], [8,14], [6,13], [4,11], [3,8], [3,6], [4,3], [6,1], [8,0], [11,0], [13,1], [15,3]]
    ]},
    
    // ASCII 98 - b
    98: { width: 19, strokes: [
        [[4,21], [4,0]],
        [[4,11], [6,13], [8,14], [11,14], [13,13], [15,11], [16,8], [16,6], [15,3], [13,1], [11,0], [8,0], [6,1], [4,3]]
    ]},
    
    // ASCII 99 - c
    99: { width: 18, strokes: [
        [[15,11], [13,13], [11,14], [8,14], [6,13], [4,11], [3,8], [3,6], [4,3], [6,1], [8,0], [11,0], [13,1], [15,3]]
    ]},
    
    // ASCII 100 - d
    100: { width: 19, strokes: [
        [[15,21], [15,0]],
        [[15,11], [13,13], [11,14], [8,14], [6,13], [4,11], [3,8], [3,6], [4,3], [6,1], [8,0], [11,0], [13,1], [15,3]]
    ]},
    
    // ASCII 101 - e
    101: { width: 18, strokes: [
        [[3,8], [15,8], [15,10], [14,12], [13,13], [11,14], [8,14], [6,13], [4,11], [3,8], [3,6], [4,3], [6,1], [8,0], [11,0], [13,1], [15,3]]
    ]},
    
    // ASCII 102 - f
    102: { width: 12, strokes: [
        [[10,21], [8,21], [6,20], [5,17], [5,0]],
        [[2,14], [9,14]]
    ]},
    
    // ASCII 103 - g
    103: { width: 19, strokes: [
        [[15,14], [15,-2], [14,-5], [13,-6], [11,-7], [8,-7], [6,-6]],
        [[15,11], [13,13], [11,14], [8,14], [6,13], [4,11], [3,8], [3,6], [4,3], [6,1], [8,0], [11,0], [13,1], [15,3]]
    ]},
    
    // ASCII 104 - h
    104: { width: 19, strokes: [
        [[4,21], [4,0]],
        [[4,10], [7,13], [9,14], [12,14], [14,13], [15,10], [15,0]]
    ]},
    
    // ASCII 105 - i
    105: { width: 8, strokes: [
        [[3,21], [4,20], [5,21], [4,22], [3,21]],
        [[4,14], [4,0]]
    ]},
    
    // ASCII 106 - j
    106: { width: 10, strokes: [
        [[5,21], [6,20], [7,21], [6,22], [5,21]],
        [[6,14], [6,-3], [5,-6], [3,-7], [1,-7]]
    ]},
    
    // ASCII 107 - k
    107: { width: 17, strokes: [
        [[4,21], [4,0]],
        [[14,14], [4,4]],
        [[8,8], [15,0]]
    ]},
    
    // ASCII 108 - l
    108: { width: 8, strokes: [
        [[4,21], [4,0]]
    ]},
    
    // ASCII 109 - m
    109: { width: 30, strokes: [
        [[4,14], [4,0]],
        [[4,10], [7,13], [9,14], [12,14], [14,13], [15,10], [15,0]],
        [[15,10], [18,13], [20,14], [23,14], [25,13], [26,10], [26,0]]
    ]},
    
    // ASCII 110 - n
    110: { width: 19, strokes: [
        [[4,14], [4,0]],
        [[4,10], [7,13], [9,14], [12,14], [14,13], [15,10], [15,0]]
    ]},
    
    // ASCII 111 - o
    111: { width: 19, strokes: [
        [[8,14], [6,13], [4,11], [3,8], [3,6], [4,3], [6,1], [8,0], [11,0], [13,1], [15,3], [16,6], [16,8], [15,11], [13,13], [11,14], [8,14]]
    ]},
    
    // ASCII 112 - p
    112: { width: 19, strokes: [
        [[4,14], [4,-7]],
        [[4,11], [6,13], [8,14], [11,14], [13,13], [15,11], [16,8], [16,6], [15,3], [13,1], [11,0], [8,0], [6,1], [4,3]]
    ]},
    
    // ASCII 113 - q
    113: { width: 19, strokes: [
        [[15,14], [15,-7]],
        [[15,11], [13,13], [11,14], [8,14], [6,13], [4,11], [3,8], [3,6], [4,3], [6,1], [8,0], [11,0], [13,1], [15,3]]
    ]},
    
    // ASCII 114 - r
    114: { width: 13, strokes: [
        [[4,14], [4,0]],
        [[4,8], [5,11], [7,13], [9,14], [12,14]]
    ]},
    
    // ASCII 115 - s
    115: { width: 17, strokes: [
        [[14,11], [13,13], [10,14], [7,14], [4,13], [3,11], [4,9], [6,8], [11,7], [13,6], [14,4], [14,3], [13,1], [10,0], [7,0], [4,1], [3,3]]
    ]},
    
    // ASCII 116 - t
    116: { width: 12, strokes: [
        [[5,21], [5,4], [6,1], [8,0], [10,0]],
        [[2,14], [9,14]]
    ]},
    
    // ASCII 117 - u
    117: { width: 19, strokes: [
        [[4,14], [4,4], [5,1], [7,0], [10,0], [12,1], [15,4]],
        [[15,14], [15,0]]
    ]},
    
    // ASCII 118 - v
    118: { width: 16, strokes: [
        [[2,14], [8,0]],
        [[14,14], [8,0]]
    ]},
    
    // ASCII 119 - w
    119: { width: 22, strokes: [
        [[3,14], [7,0]],
        [[11,14], [7,0]],
        [[11,14], [15,0]],
        [[19,14], [15,0]]
    ]},
    
    // ASCII 120 - x
    120: { width: 17, strokes: [
        [[3,14], [14,0]],
        [[14,14], [3,0]]
    ]},
    
    // ASCII 121 - y
    121: { width: 16, strokes: [
        [[2,14], [8,0]],
        [[14,14], [8,0], [6,-4], [4,-6], [2,-7], [1,-7]]
    ]},
    
    // ASCII 122 - z
    122: { width: 17, strokes: [
        [[14,14], [3,0]],
        [[3,14], [14,14]],
        [[3,0], [14,0]]
    ]},
    
    // ASCII 123 - {
    123: { width: 14, strokes: [
        [[9,25], [7,24], [6,23], [5,21], [5,19], [6,17], [7,16], [8,14], [8,12], [6,10]],
        [[7,24], [6,22], [6,20], [7,18], [8,17], [9,15], [9,13], [8,11], [4,9], [8,7], [9,5], [9,3], [8,1], [7,0], [6,-2], [6,-4], [7,-6]],
        [[6,8], [8,6], [8,4], [7,2], [6,1], [5,-1], [5,-3], [6,-5], [7,-6], [9,-7]]
    ]},
    
    // ASCII 124 - |
    124: { width: 8, strokes: [
        [[4,25], [4,-7]]
    ]},
    
    // ASCII 125 - }
    125: { width: 14, strokes: [
        [[5,25], [7,24], [8,23], [9,21], [9,19], [8,17], [7,16], [6,14], [6,12], [8,10]],
        [[7,24], [8,22], [8,20], [7,18], [6,17], [5,15], [5,13], [6,11], [10,9], [6,7], [5,5], [5,3], [6,1], [7,0], [8,-2], [8,-4], [7,-6]],
        [[8,8], [6,6], [6,4], [7,2], [8,1], [9,-1], [9,-3], [8,-5], [7,-6], [5,-7]]
    ]},
    
    // ASCII 126 - ~
    126: { width: 24, strokes: [
        [[3,6], [3,8], [4,11], [6,12], [8,12], [10,11], [14,8], [16,7], [18,7], [20,8], [21,10]],
        [[3,8], [4,10], [6,11], [8,11], [10,10], [14,7], [16,6], [18,6], [20,7], [21,10], [21,12]]
    ]}
};

// Step 2) Get character data with fallback
function getCharData(char) {
    const code = char.charCodeAt(0);
    if (HERSHEY_SIMPLEX[code]) {
        return HERSHEY_SIMPLEX[code];
    }
    // Fallback: return '?' for unknown characters
    if (code !== 63) {
        console.warn("VectorFont: Unknown character '" + char + "' (code " + code + "), using '?'");
        return HERSHEY_SIMPLEX[63]; // '?'
    }
    // If even '?' is missing, return empty
    return { width: 10, strokes: [] };
}

// Step 3) Check if a character is supported
export function hasCharacter(char) {
    const code = char.charCodeAt(0);
    return HERSHEY_SIMPLEX[code] !== undefined;
}

// Step 4) Get supported character list
export function getSupportedCharacters() {
    return Object.keys(HERSHEY_SIMPLEX).map(function(code) {
        return String.fromCharCode(parseInt(code));
    }).join("");
}

// Step 5) Calculate text width
export function getTextWidth(text, size) {
    const scale = size / 21; // Hershey font has height of ~21 units
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
        const charData = getCharData(text[i]);
        totalWidth += charData.width * scale;
    }
    return totalWidth;
}

// Step 6) Get text as line segments (universal format)
// Returns array of line segments: [{x1, y1, x2, y2}, ...]
// flipY: true for 2D canvas (Y-down), false for 3D Three.js (Y-up)
export function getTextLineSegments(text, size, anchorX, anchorY, flipY) {
    // Step 6a) Default anchor values
    anchorX = anchorX || "left"; // "left", "center", "right"
    anchorY = anchorY || "baseline"; // "top", "middle", "baseline", "bottom"
    flipY = (flipY !== false); // Default to true for backward compatibility (2D canvas)
    
    const scale = size / 21;
    const segments = [];
    
    // Step 6b) Calculate total width for anchor positioning
    const totalWidth = getTextWidth(text, size);
    
    // Step 6c) Calculate starting X offset based on anchor
    let startX = 0;
    if (anchorX === "center") {
        startX = -totalWidth / 2;
    } else if (anchorX === "right") {
        startX = -totalWidth;
    }
    
    // Step 6d) Calculate Y offset based on anchor and flipY mode
    let yOffset = 0;
    if (flipY) {
        // 2D Canvas mode (Y-down): flip Y coordinates
        if (anchorY === "top") {
            yOffset = 0;
        } else if (anchorY === "middle") {
            yOffset = 10.5 * scale;
        } else if (anchorY === "bottom" || anchorY === "baseline") {
            yOffset = 21 * scale;
        }
    } else {
        // 3D mode (Y-up): keep Y coordinates as-is
        if (anchorY === "top") {
            yOffset = -21 * scale;
        } else if (anchorY === "middle") {
            yOffset = -10.5 * scale;
        } else if (anchorY === "bottom" || anchorY === "baseline") {
            yOffset = 0;
        }
    }
    
    // Step 6e) Process each character
    let currentX = startX;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charData = getCharData(char);
        
        // Step 6f) Process each stroke in the character
        for (let s = 0; s < charData.strokes.length; s++) {
            const stroke = charData.strokes[s];
            
            // Step 6g) Convert stroke points to line segments
            for (let p = 1; p < stroke.length; p++) {
                const p1 = stroke[p - 1];
                const p2 = stroke[p];
                
                if (flipY) {
                    // 2D Canvas: flip Y (canvas Y-down, Hershey Y-up)
                    segments.push({
                        x1: currentX + p1[0] * scale,
                        y1: yOffset - p1[1] * scale,
                        x2: currentX + p2[0] * scale,
                        y2: yOffset - p2[1] * scale
                    });
                } else {
                    // 3D Three.js: keep Y as-is (both Y-up)
                    segments.push({
                        x1: currentX + p1[0] * scale,
                        y1: yOffset + p1[1] * scale,
                        x2: currentX + p2[0] * scale,
                        y2: yOffset + p2[1] * scale
                    });
                }
            }
        }
        
        // Step 6h) Advance X position by character width
        currentX += charData.width * scale;
    }
    
    return segments;
}

//==============================================================================
// 2D CANVAS RENDERING
//==============================================================================

// Step 7) Draw text on 2D canvas context
export function drawText2D(ctx, x, y, text, size, color, anchorX, anchorY, rotation) {
    // Step 7a) Default values
    color = color || "#000000";
    anchorX = anchorX || "left";
    anchorY = anchorY || "baseline";
    rotation = rotation || 0;
    
    // Step 7b) Get line segments
    const segments = getTextLineSegments(text, size, anchorX, anchorY);
    
    if (segments.length === 0) return;
    
    // Step 7c) Save context state
    ctx.save();
    
    // Step 7d) Apply transformation (translate to position, then rotate)
    ctx.translate(x, y);
    if (rotation !== 0) {
        ctx.rotate(rotation);
    }
    
    // Step 7e) Set stroke style
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size / 15); // Scale line width with font size
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    // Step 7f) Draw all segments
    ctx.beginPath();
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();
    
    // Step 7g) Restore context state
    ctx.restore();
}

//==============================================================================
// 3D THREE.JS RENDERING
//==============================================================================

// Step 8) Create Three.js LineSegments for text
// Returns a THREE.LineSegments object
export function createText3D(THREE, x, y, z, text, size, color, anchorX, anchorY) {
    // Step 8a) Default values
    anchorX = anchorX || "left";
    anchorY = anchorY || "middle";
    
    // Step 8b) Get line segments (flipY=false for 3D Y-up coordinate system)
    const segments = getTextLineSegments(text, size, anchorX, anchorY, false);
    
    if (segments.length === 0) {
        return null;
    }
    
    // Step 8c) Create positions array for BufferGeometry
    const positions = new Float32Array(segments.length * 6); // 2 points * 3 coords
    
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const idx = i * 6;
        
        // First point (x, y, z) - Y is up in Three.js, but we keep Z as elevation
        positions[idx] = seg.x1;
        positions[idx + 1] = seg.y1;
        positions[idx + 2] = 0; // Flat in XY plane, will be positioned by mesh
        
        // Second point
        positions[idx + 3] = seg.x2;
        positions[idx + 4] = seg.y2;
        positions[idx + 5] = 0;
    }
    
    // Step 8d) Create BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    
    // Step 8e) Create material
    const threeColor = new THREE.Color(color || "#000000");
    const material = new THREE.LineBasicMaterial({
        color: threeColor,
        linewidth: 1, // Note: linewidth > 1 only works in WebGL2 with specific extensions
        transparent: false,
        depthTest: true,
        depthWrite: true
    });
    
    // Step 8f) Create LineSegments mesh
    const lineSegments = new THREE.LineSegments(geometry, material);
    
    // Step 8g) Position the text in 3D space
    lineSegments.position.set(x, y, z);
    
    // Step 8h) Mark as vector text for identification
    lineSegments.userData.isVectorText = true;
    lineSegments.userData.text = text;
    
    return lineSegments;
}

// Step 9) Get raw vertex data for batching with other geometry
// Returns {positions: Float32Array, count: number}
export function getTextVertices3D(text, size, offsetX, offsetY, offsetZ, anchorX, anchorY) {
    // Step 9a) Get line segments (flipY=false for 3D Y-up coordinate system)
    const segments = getTextLineSegments(text, size, anchorX, anchorY, false);
    
    if (segments.length === 0) {
        return { positions: new Float32Array(0), count: 0 };
    }
    
    // Step 9b) Create positions array
    const positions = new Float32Array(segments.length * 6);
    
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const idx = i * 6;
        
        // Apply offset to position text in world space
        positions[idx] = offsetX + seg.x1;
        positions[idx + 1] = offsetY + seg.y1;
        positions[idx + 2] = offsetZ;
        
        positions[idx + 3] = offsetX + seg.x2;
        positions[idx + 4] = offsetY + seg.y2;
        positions[idx + 5] = offsetZ;
    }
    
    return {
        positions: positions,
        count: segments.length * 2 // Number of vertices
    };
}

//==============================================================================
// SVG / PRINT RENDERING
//==============================================================================

// Step 10) Get SVG path data for text
// Returns SVG path "d" attribute string
export function getTextSVGPath(text, x, y, size, anchorX, anchorY) {
    // Step 10a) Get line segments
    const segments = getTextLineSegments(text, size, anchorX, anchorY);
    
    if (segments.length === 0) {
        return "";
    }
    
    // Step 10b) Build SVG path string
    let pathData = "";
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        // Move to first point, Line to second point
        pathData += "M " + (x + seg.x1).toFixed(2) + " " + (y + seg.y1).toFixed(2);
        pathData += " L " + (x + seg.x2).toFixed(2) + " " + (y + seg.y2).toFixed(2) + " ";
    }
    
    return pathData.trim();
}

// Step 11) Create complete SVG text element (as path)
export function createSVGVectorText(x, y, text, size, color, anchorX, anchorY, strokeWidth) {
    // Step 11a) Default values
    color = color || "#000000";
    strokeWidth = strokeWidth || Math.max(0.5, size / 15);
    
    // Step 11b) Get path data
    const pathData = getTextSVGPath(text, x, y, size, anchorX, anchorY);
    
    if (!pathData) {
        return "";
    }
    
    // Step 11c) Return SVG path element
    return "<path d=\"" + pathData + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"" + strokeWidth + "\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>";
}

//==============================================================================
// DXF EXPORT SUPPORT
//==============================================================================

// Step 12) Get text as DXF LINE entities
// Returns array of {x1, y1, x2, y2} in world coordinates
export function getTextDXFLines(text, x, y, z, size, anchorX, anchorY, rotation) {
    // Step 12a) Get base line segments
    const segments = getTextLineSegments(text, size, anchorX, anchorY);
    
    if (segments.length === 0) {
        return [];
    }
    
    // Step 12b) Apply rotation if specified
    const cosR = Math.cos(rotation || 0);
    const sinR = Math.sin(rotation || 0);
    
    // Step 12c) Transform to world coordinates
    const dxfLines = [];
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        
        // Apply rotation
        const rx1 = seg.x1 * cosR - seg.y1 * sinR;
        const ry1 = seg.x1 * sinR + seg.y1 * cosR;
        const rx2 = seg.x2 * cosR - seg.y2 * sinR;
        const ry2 = seg.x2 * sinR + seg.y2 * cosR;
        
        dxfLines.push({
            x1: x + rx1,
            y1: y + ry1,
            z1: z,
            x2: x + rx2,
            y2: y + ry2,
            z2: z
        });
    }
    
    return dxfLines;
}

//==============================================================================
// EXPORTS
//==============================================================================

export default {
    hasCharacter: hasCharacter,
    getSupportedCharacters: getSupportedCharacters,
    getTextWidth: getTextWidth,
    getTextLineSegments: getTextLineSegments,
    drawText2D: drawText2D,
    createText3D: createText3D,
    getTextVertices3D: getTextVertices3D,
    getTextSVGPath: getTextSVGPath,
    createSVGVectorText: createSVGVectorText,
    getTextDXFLines: getTextDXFLines
};
