// Chart Manager - Handles all chart creation and updates
class ChartManager {
    constructor() {
        this.charts = new Map();
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12,
                        },
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14,
                        weight: 'bold',
                    },
                    bodyFont: {
                        size: 13,
                    },
                    cornerRadius: 8,
                },
            },
        };
    }

    /**
     * Create or update a pie chart
     */
    createPieChart(canvasId, data, options = {}) {
        this.destroyChart(canvasId);

        const ctx = document.getElementById(canvasId).getContext('2d');
        const chartOptions = {
            ...this.defaultOptions,
            ...options,
            plugins: {
                ...this.defaultOptions.plugins,
                ...options.plugins,
                tooltip: {
                    ...this.defaultOptions.plugins.tooltip,
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                        },
                    },
                },
            },
        };

        const chart = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: chartOptions,
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create or update a bar chart
     */
    createBarChart(canvasId, data, options = {}) {
        this.destroyChart(canvasId);

        const ctx = document.getElementById(canvasId).getContext('2d');
        const chartOptions = {
            ...this.defaultOptions,
            ...options,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        },
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)',
                    },
                },
                x: {
                    grid: {
                        display: false,
                    },
                },
            },
            plugins: {
                ...this.defaultOptions.plugins,
                ...options.plugins,
                legend: {
                    display: false,
                },
            },
        };

        const chart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: chartOptions,
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create or update a line chart
     */
    createLineChart(canvasId, data, options = {}) {
        this.destroyChart(canvasId);

        const ctx = document.getElementById(canvasId).getContext('2d');
        const chartOptions = {
            ...this.defaultOptions,
            ...options,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        },
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                    },
                },
                x: {
                    grid: {
                        display: false,
                    },
                },
            },
            plugins: {
                ...this.defaultOptions.plugins,
                ...options.plugins,
            },
            elements: {
                line: {
                    tension: 0.4,
                    borderWidth: 3,
                },
                point: {
                    radius: 4,
                    hitRadius: 10,
                    hoverRadius: 6,
                },
            },
        };

        const chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: chartOptions,
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create or update a doughnut chart
     */
    createDoughnutChart(canvasId, data, options = {}) {
        this.destroyChart(canvasId);

        const ctx = document.getElementById(canvasId).getContext('2d');
        const chartOptions = {
            ...this.defaultOptions,
            ...options,
            cutout: '60%',
            plugins: {
                ...this.defaultOptions.plugins,
                ...options.plugins,
                tooltip: {
                    ...this.defaultOptions.plugins.tooltip,
                    callbacks: {
                        label: function (context) {
                            const label = context.label || '';
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                        },
                    },
                },
            },
        };

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: chartOptions,
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Create a mixed chart (bar + line)
     */
    createMixedChart(canvasId, data, options = {}) {
        this.destroyChart(canvasId);

        const ctx = document.getElementById(canvasId).getContext('2d');
        const chartOptions = {
            ...this.defaultOptions,
            ...options,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '$' + value.toFixed(0);
                        },
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                    },
                },
                x: {
                    grid: {
                        display: false,
                    },
                },
            },
        };

        const chart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: chartOptions,
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    /**
     * Update existing chart data
     */
    updateChart(canvasId, newData) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.data = newData;
            chart.update();
        }
    }

    /**
     * Destroy a chart
     */
    destroyChart(canvasId) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.destroy();
            this.charts.delete(canvasId);
        }
    }

    /**
     * Destroy all charts
     */
    destroyAllCharts() {
        this.charts.forEach((chart) => {
            chart.destroy();
        });
        this.charts.clear();
    }

    /**
     * Generate color palette
     */
    getColorPalette(count) {
        const baseColors = [
            '#6366F1', // primary
            '#8B5CF6', // secondary
            '#EC4899', // pink
            '#10B981', // green
            '#F59E0B', // yellow
            '#3B82F6', // blue
            '#EF4444', // red
            '#14B8A6', // teal
            '#F97316', // orange
            '#A855F7', // purple
            '#84CC16', // lime
            '#06B6D4', // cyan
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }

    /**
     * Get gradient colors
     */
    getGradientColor(ctx, color1, color2) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    }

    /**
     * Format data for charts
     */
    formatChartData(labels, datasets, type = 'bar') {
        const colors = this.getColorPalette(labels.length);

        if (type === 'pie' || type === 'doughnut') {
            return {
                labels: labels,
                datasets: [
                    {
                        data: datasets,
                        backgroundColor: colors,
                        borderColor: '#ffffff',
                        borderWidth: 2,
                    },
                ],
            };
        } else if (type === 'line') {
            return {
                labels: labels,
                datasets: [
                    {
                        label: 'Amount',
                        data: datasets,
                        borderColor: colors[0],
                        backgroundColor: colors[0] + '20',
                        fill: true,
                    },
                ],
            };
        } else {
            return {
                labels: labels,
                datasets: [
                    {
                        label: 'Amount',
                        data: datasets,
                        backgroundColor: colors.map((c) => c + '80'),
                        borderColor: colors,
                        borderWidth: 2,
                    },
                ],
            };
        }
    }

    /**
     * Export chart as image
     */
    exportChart(canvasId, filename = 'chart.png') {
        const chart = this.charts.get(canvasId);
        if (chart) {
            const url = chart.toBase64Image();
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
        }
    }
}

// Create global instance
const chartManager = new ChartManager();
