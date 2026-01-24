///------------------ STATISTICS CALCULATIONS HERE ------------------///
// #region STATS

// Helper: Get mode with tolerance
function getModeWithTolerance(values, tolerance) {
    const bins = {};
    values.forEach((val) => {
        const bin = Math.round(val / tolerance) * tolerance;
        bins[bin] = (bins[bin] || 0) + 1;
    });
    let mode = null,
        maxCount = 0;
    for (let bin in bins) {
        if (bins[bin] > maxCount) {
            maxCount = bins[bin];
            mode = parseFloat(bin);
        }
    }
    return mode;
}

// Helper: Group holes by entityName
function groupHolesByEntity(holes) {
    const groups = {};
    holes.forEach((hole) => {
        const key = hole.entityName || "Unknown";
        if (!groups[key]) groups[key] = [];
        groups[key].push(hole);
    });
    return groups;
}

// Helper: Group holes by rowID
function groupHolesByRow(holes) {
    const rows = {};
    holes.forEach((hole) => {
        const key = hole.rowID || "Unknown";
        if (!rows[key]) rows[key] = [];
        rows[key].push(hole);
    });
    return rows;
}

// Helper: Group holes by delay, and get most common color for each delay group
function groupHolesByDelay(holes) {
    const groups = {};
    holes.forEach((hole) => {
        const key = hole.timingDelayMilliseconds !== undefined && hole.timingDelayMilliseconds !== null ? hole.timingDelayMilliseconds : "Unknown";
        if (!groups[key]) {
            groups[key] = { count: 0, colors: {} };
        }
        groups[key].count++;
        const color = hole.colorHexDecimal || "#fff";
        groups[key].colors[color] = (groups[key].colors[color] || 0) + 1;
    });
    // Now, for each group, pick the most common color
    const result = {};
    Object.keys(groups).forEach((delay) => {
        const colorCounts = groups[delay].colors;
        let mostCommonColor = "#fff";
        let maxCount = 0;
        for (let color in colorCounts) {
            if (colorCounts[color] > maxCount) {
                maxCount = colorCounts[color];
                mostCommonColor = color;
            }
        }
        result[delay] = {
            count: groups[delay].count,
            color: mostCommonColor
        };
    });
    return result;
}

// Main: Calculate statistics per entityName
export function getBlastStatisticsPerEntity(allBlastHoles, getVoronoiMetrics) {
    const tolerance = 0.1; // 100mm
    const holes = allBlastHoles || [];
    const entityGroups = groupHolesByEntity(holes);
    const statsPerEntity = {};

    Object.keys(entityGroups).forEach((entityName) => {
        const entityHoles = entityGroups[entityName];

        // Step 86) Group by rows for burden/spacing
        const rows = Object.values(groupHolesByRow(entityHoles));
        const rowCentroids = rows.map((rowHoles) => {
            const avgY = rowHoles.reduce((sum, h) => sum + h.startYLocation, 0) / rowHoles.length;
            const avgX = rowHoles.reduce((sum, h) => sum + h.startXLocation, 0) / rowHoles.length;
            return { x: avgX, y: avgY };
        });
        
        // Step 94) Calculate burden from row centroids
        const burdens = [];
        for (let i = 1; i < rowCentroids.length; i++) {
            const dx = rowCentroids[i].x - rowCentroids[i - 1].x;
            const dy = rowCentroids[i].y - rowCentroids[i - 1].y;
            burdens.push(Math.sqrt(dx * dx + dy * dy));
        }
        
        // Step 99) Calculate spacings within rows
        const spacings = [];
        rows.forEach((rowHoles) => {
            rowHoles.sort((a, b) => a.posID - b.posID);
            for (let i = 1; i < rowHoles.length; i++) {
                const dx = rowHoles[i].startXLocation - rowHoles[i - 1].startXLocation;
                const dy = rowHoles[i].startYLocation - rowHoles[i - 1].startYLocation;
                spacings.push(Math.sqrt(dx * dx + dy * dy));
            }
        });
        
        // Step 99b) Fallback: Use hole properties if calculated values are 0 or empty
        // Check if holes have burden/spacing properties set
        var holeBurdens = entityHoles.map(function(h) { return parseFloat(h.burden) || 0; }).filter(function(v) { return v > 0; });
        var holeSpacings = entityHoles.map(function(h) { return parseFloat(h.spacing) || 0; }).filter(function(v) { return v > 0; });

        // Drill length
        const drillMetres = entityHoles.reduce((sum, h) => sum + (parseFloat(h.holeLengthCalculated) || 0), 0);

        // Explosive mass
        const expMass = entityHoles.reduce((sum, h) => sum + (parseFloat(h.measuredMass) || 0), 0);

        // Step 115) Volume calculation using new donut-aware method
        // Use window.getBlastEntityVolume for accurate volume with proper boundary calculation
        var volume = 0;
        var surfaceArea = 0;
        if (typeof window.getBlastEntityVolume === "function") {
            // Use the new accurate volume calculation
            volume = window.getBlastEntityVolume(entityHoles, entityName);
            // Surface area = volume / average benchHeight
            var totalBenchHeight = entityHoles.reduce(function(sum, h) { 
                return sum + (parseFloat(h.benchHeight) || 0); 
            }, 0);
            var avgBenchHeight = totalBenchHeight / entityHoles.length;
            surfaceArea = avgBenchHeight > 0 ? volume / avgBenchHeight : 0;
        } else {
            // Fallback to old Voronoi method (less accurate for subsets)
            console.warn("[BlastStatistics] getBlastEntityVolume not available, using Voronoi fallback");
            const voronoiMetrics = getVoronoiMetrics(entityHoles, false);
            volume = voronoiMetrics.reduce((sum, cell) => sum + (cell.volume || 0), 0);
            surfaceArea = voronoiMetrics.reduce((sum, cell) => sum + (cell.area || 0), 0);
        }

        // Delay grouping
        const delayGroups = groupHolesByDelay(entityHoles);

        // Firing times
        const firingTimes = voronoiMetrics.map((cell) => cell.holeFiringTime).filter((t) => t !== undefined && t !== null && !isNaN(t));
        const minFiringTime = firingTimes.length ? Math.min(...firingTimes) : null;
        const maxFiringTime = firingTimes.length ? Math.max(...firingTimes) : null;

        // Step 128) Calculate final burden and spacing with fallback to hole properties
        var calculatedBurden = getModeWithTolerance(burdens, tolerance) || 0;
        var calculatedSpacing = getModeWithTolerance(spacings, tolerance) || 0;
        
        // Step 128b) If calculated values are 0, try using hole property values
        if (calculatedBurden === 0 && holeBurdens.length > 0) {
            calculatedBurden = getModeWithTolerance(holeBurdens, tolerance) || 0;
        }
        if (calculatedSpacing === 0 && holeSpacings.length > 0) {
            calculatedSpacing = getModeWithTolerance(holeSpacings, tolerance) || 0;
        }
        
        statsPerEntity[entityName] = {
            holeCount: entityHoles.length,
            burden: calculatedBurden,
            spacing: calculatedSpacing,
            drillMetres: drillMetres,
            expMass: expMass,
            volume: volume,
            surfaceArea: surfaceArea,
            delayGroups: delayGroups,
            minFiringTime: minFiringTime,
            maxFiringTime: maxFiringTime
        };
    });
    return statsPerEntity;
}

// Export helper functions for potential reuse
export { getModeWithTolerance, groupHolesByEntity, groupHolesByRow, groupHolesByDelay };

//#endregion STATS

