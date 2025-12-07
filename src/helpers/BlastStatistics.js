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

        // Group by rows for burden/spacing
        const rows = Object.values(groupHolesByRow(entityHoles));
        const rowCentroids = rows.map((rowHoles) => {
            const avgY = rowHoles.reduce((sum, h) => sum + h.startYLocation, 0) / rowHoles.length;
            const avgX = rowHoles.reduce((sum, h) => sum + h.startXLocation, 0) / rowHoles.length;
            return { x: avgX, y: avgY };
        });
        const burdens = [];
        for (let i = 1; i < rowCentroids.length; i++) {
            const dx = rowCentroids[i].x - rowCentroids[i - 1].x;
            const dy = rowCentroids[i].y - rowCentroids[i - 1].y;
            burdens.push(Math.sqrt(dx * dx + dy * dy));
        }
        const spacings = [];
        rows.forEach((rowHoles) => {
            rowHoles.sort((a, b) => a.posID - b.posID);
            for (let i = 1; i < rowHoles.length; i++) {
                const dx = rowHoles[i].startXLocation - rowHoles[i - 1].startXLocation;
                const dy = rowHoles[i].startYLocation - rowHoles[i - 1].startYLocation;
                spacings.push(Math.sqrt(dx * dx + dy * dy));
            }
        });

        // Drill length
        const drillMetres = entityHoles.reduce((sum, h) => sum + (parseFloat(h.holeLengthCalculated) || 0), 0);

        // Explosive mass
        const expMass = entityHoles.reduce((sum, h) => sum + (parseFloat(h.measuredMass) || 0), 0);

        // Voronoi metrics (volume, area, firing time)
        const voronoiMetrics = getVoronoiMetrics(entityHoles, false);
        const volume = voronoiMetrics.reduce((sum, cell) => sum + (cell.volume || 0), 0);
        const surfaceArea = voronoiMetrics.reduce((sum, cell) => sum + (cell.area || 0), 0);

        // Delay grouping
        const delayGroups = groupHolesByDelay(entityHoles);

        // Firing times
        const firingTimes = voronoiMetrics.map((cell) => cell.holeFiringTime).filter((t) => t !== undefined && t !== null && !isNaN(t));
        const minFiringTime = firingTimes.length ? Math.min(...firingTimes) : null;
        const maxFiringTime = firingTimes.length ? Math.max(...firingTimes) : null;

        statsPerEntity[entityName] = {
            holeCount: entityHoles.length,
            burden: getModeWithTolerance(burdens, tolerance) || 0,
            spacing: getModeWithTolerance(spacings, tolerance) || 0,
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

