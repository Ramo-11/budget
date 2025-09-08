// Category configuration based on your exact Python code
const CATEGORY_CONFIG = {
    'Once A Year': ['GOOGLE *Domains', 'PLANET FITNESS'],
    'Groceries': ['COSTCO', 'WAL-MART'],
    'Gas': ['BP', 'KROGER FUEL'],
    'Subscriptions': ['GOOGLE', 'Amazon web services', 'CHATGPT', 'APPLE', 'TWITTER', 'X CORP', 'CLAUDE', 'NETFLIX', 'PARAMOUNT', 'CANVA'],
    'Coffee and Tea': ['NIYYAH', 'MOTW', 'INDIE COFFEE', 'MARIAM', 'YAFA', 'JAVA HOUSE', 'Qahwa', 'JABAL', 'DUNKIN', 'KICK STARRT'],
    'Food & Drink': ['PITA LAND', 'MAESTRO PIZZA', 'HOMEMADE ICE'],
    'Shopping': ['AMZN', 'Amazon'],
    'Rent': ['WILLOW GLEN EAST'],
    'Insurance': ['STATE FARM'],
    'Internet': ['ATT*BILL'],
    'Parking': ['PARKMOBILE'],
    'Laundry': ['LAUNDRY'],
    'Haircut': ['GREAT CLIPS', 'Barber'],
    'Soccer': ['OFF THE WALL'],
    'Car': ['CREW', 'BEST ONE', 'ED MARTIN TOYOTA'],
    'Phone': ['Visible']
};

// Smart categorization patterns (only for items not explicitly handled)
const SMART_PATTERNS = {
    'Food & Drink': {
        keywords: ['RESTAURANT', 'PIZZA', 'BURGER', 'TACO', 'SUSHI', 'DELI', 'CAFE', 'BISTRO', 'GRILL', 'KITCHEN', 'EATERY', 'FOOD', 'DINING', 'BAR', 'PUB', 'BREWERY', 'HOTBOYS', 'CHICKEN', 'WINGS', 'DONUT', 'BAKERY', 'SANDWICH', 'SUBWAY', 'MCDONALD', 'WENDY', 'TBELL', 'KFC', 'CHIPOTLE', 'PANERA'],
        patterns: [/TST\*.*/, /SQ \*.*RESTAURANT/, /SQ \*.*FOOD/, /.*PIZZA.*/, /.*BURGER.*/, /.*KITCHEN.*/, /.*GRILL.*/, /.*CAFE.*/, /.*BAR\s/, /.*DELI.*/, /.*WINGS.*/, /.*CHICKEN.*/]
    },
    'Groceries': {
        keywords: ['KROGER', 'WALMART', 'TARGET', 'SAFEWAY', 'WHOLE FOODS', 'TRADER JOE', 'ALDI', 'PUBLIX', 'WEGMANS', 'HARRIS TEETER', 'GIANT', 'FOOD LION', 'MEIJER', 'HEB', 'WINCO', 'SMITHS', 'RALPHS', 'VONS', 'ALBERTSONS', 'ACME', 'SHOPRITE', 'STOP SHOP', 'KING SOOPERS', 'CITY MARKET', 'FRYS', 'DILLONS', 'GERBES', 'BAKERS', 'COPPS'],
        patterns: [/KROGER.*/, /WALMART.*/, /TARGET.*/, /.*GROCERY.*/, /.*MARKET.*/, /.*SUPERMARKET.*/]
    },
    'Gas': {
        keywords: ['SHELL', 'CHEVRON', 'MOBIL', 'EXXON', 'TEXACO', 'CITGO', 'SUNOCO', 'MARATHON', 'SPEEDWAY', '76', 'ARCO', 'VALERO', 'CONOCO', 'PHILLIPS 66', 'SINCLAIR', 'WAWA', 'SHEETZ', 'CASEY', 'KWIK TRIP', 'QT', 'RACETRAC', 'CIRCLE K', 'MURPHY', 'COSTCO GAS', 'SAM\'S CLUB GAS', 'MAPCO', 'PILOT', 'LOVES', 'AMOCO'],
        patterns: [/.*GAS.*/, /.*FUEL.*/, /.*STATION.*/, /.*#\d+.*GAS/, /MAPCO.*/, /PILOT.*/, /LOVE'S.*/, /LOVES.*/, /AMOCO.*/]
    },
    'Coffee and Tea': {
        keywords: ['STARBUCKS', 'DUNKIN', 'PEET', 'CARIBOU', 'DUTCH BROS', 'TIM HORTONS', 'COSTA', 'BLUE BOTTLE', 'PHILZ', 'INTELLIGENTSIA', 'COUNTER CULTURE', 'RITUAL', 'FOUR BARREL', 'SIGHTGLASS'],
        patterns: [/.*COFFEE.*/, /.*ESPRESSO.*/, /.*BREW.*/, /.*ROAST.*/, /SQ \*.*COFFEE/, /.*TEA.*HOUSE/]
    },
    'Parking': {
        keywords: ['PARKING', 'PARK', 'METER', 'GARAGE', 'LOT'],
        patterns: [/.*PARKING.*/, /.*GARAGE.*/, /PARK.*METER/, /.*LOT.*PARK/]
    }
};

class ExpenseAnalyzer {
    constructor() {
        this.categoryTotals = {
            'Rent': 1220,
            'Gas': 0,
            'Insurance': 0,
            'Internet': 0,
            'Groceries': 0,
            'Coffee and Tea': 0,
            'Food & Drink': 0,
            'Shopping': 0,
            'Phone': 0,
            'Parking': 0,
            'Travel': 0,
            'Subscriptions': 0,
            'Laundry': 0,
            'Haircut': 0,
            'Soccer': 0,
            'Car': 0,
            'Once A Year': 0,
            'Others': 0,
        };
        this.categoryDetails = {};
        this.processedData = [];
        this.smartCategorizedCount = 0;
    }

    parseCSV(csvText) {
        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => {
                    resolve(results.data);
                }
            });
        });
    }

    categorizeTransaction(description) {
        // First, check your exact keyword matches (highest priority)
        for (const [category, keywords] of Object.entries(CATEGORY_CONFIG)) {
            for (const keyword of keywords) {
                if (description.toUpperCase().includes(keyword.toUpperCase())) {
                    return category;
                }
            }
        }

        // Only use smart categorization if no exact match found
        this.smartCategorizedCount++;
        return this.smartCategorize(description);
    }

    smartCategorize(description) {
        const upperDesc = description.toUpperCase();
        
        // Check each smart pattern category
        for (const [category, config] of Object.entries(SMART_PATTERNS)) {
            // Check keywords
            for (const keyword of config.keywords) {
                if (upperDesc.includes(keyword.toUpperCase())) {
                    return category;
                }
            }
            
            // Check regex patterns
            if (config.patterns) {
                for (const pattern of config.patterns) {
                    if (pattern.test(upperDesc)) {
                        return category;
                    }
                }
            }
        }

        // Additional smart logic for common patterns
        if (this.isLikelyFood(upperDesc)) {
            return 'Food & Drink';
        }

        if (this.isLikelyGas(upperDesc)) {
            return 'Gas';
        }

        return 'Others';
    }

    isLikelyFood(description) {
        const foodIndicators = [
            /.*\s*#\d+.*/, // Many restaurants have # followed by numbers
            /TST\*.*/, // Toast POS system prefix
            /SQ\s*\*.*/, // Square payment system
            /.*GRILL.*/, /.*KITCHEN.*/, /.*EATERY.*/, /.*DINER.*/,
            /.*HOTBOYS.*/, /.*HOT\s*BOYS.*/, // Specific to your example
            /.*RESTAURANT.*/, /.*FOOD.*/, /.*DINING.*/
        ];

        return foodIndicators.some(pattern => pattern.test(description));
    }

    isLikelyGas(description) {
        const gasIndicators = [
            /.*FUEL.*/, /.*PETROL.*/, /.*GASOLINE.*/,
            /.*STATION.*\d+/, // Gas stations often have numbers
            /#\d+.*GAS/, /GAS.*#\d+/
        ];

        return gasIndicators.some(pattern => pattern.test(description));
    }

    processData(data) {
        // Filter out payments and invalid entries
        const validData = data.filter(row => 
            row.Description && 
            !row.Description.toLowerCase().includes('payment thank') &&
            row.Amount !== null && 
            row.Amount !== undefined
        );

        // Reset totals and counters
        Object.keys(this.categoryTotals).forEach(key => {
            if (key !== 'Rent') this.categoryTotals[key] = 0;
        });
        this.categoryDetails = {};
        this.smartCategorizedCount = 0;

        // Create a copy of the data to process (mimicking the Python logic)
        let remainingData = [...validData];

        // Step 1: Process explicit keyword matches first (like Python parse_data calls)
        remainingData = this.processExplicitCategories(remainingData);

        // Step 2: Process remaining data by CSV Category column
        remainingData = this.processByCSVCategory(remainingData);

        // Step 3: Everything else goes to Others
        this.processOthersCategory(remainingData);

        this.processedData = validData;
    }

    processExplicitCategories(data) {
        let remainingData = [...data];

        // Process each category with explicit keywords (matching your Python order)
        const categoryOrder = [
            'Once A Year', 'Groceries', 'Gas', 'Subscriptions', 'Coffee and Tea',
            'Food & Drink', 'Shopping', 'Rent', 'Insurance', 'Internet',
            'Parking', 'Laundry', 'Haircut', 'Soccer', 'Car', 'Phone'
        ];

        categoryOrder.forEach(category => {
            remainingData = this.processExplicitCategory(remainingData, category);
        });

        return remainingData;
    }

    processExplicitCategory(data, category) {
        const keywords = CATEGORY_CONFIG[category] || [];
        const minAmount = category === 'Gas' ? 20 : 0;
        
        const matchedIndices = [];
        const gasLowAmountIndices = []; // For gas transactions under $20

        data.forEach((row, index) => {
            const amount = Math.abs(parseFloat(row.Amount) || 0);
            const description = row.Description.toUpperCase();
            const isReturn = row.Type === 'Return';
            
            // Check if description matches any keyword for this category
            const hasKeywordMatch = keywords.some(keyword => {
                const upperKeyword = keyword.toUpperCase();
                return description.includes(upperKeyword);
            });

            if (hasKeywordMatch) {
                if (category === 'Gas') {
                    // For gas: Returns go directly to Gas category regardless of amount
                    // Non-returns follow the $20 rule
                    if (isReturn || amount >= minAmount) {
                        matchedIndices.push(index);
                    } else {
                        gasLowAmountIndices.push(index);
                    }
                } else if (amount >= minAmount) {
                    matchedIndices.push(index);
                }
            }
        });

        // Process matched transactions
        matchedIndices.forEach(index => {
            const row = data[index];
            const amount = Math.abs(parseFloat(row.Amount) || 0);
            const isReturn = row.Type === 'Return';
            this.addToCategory(category, row, amount, isReturn);
        });

        // Process low-amount gas transactions (go to Food & Drink)
        gasLowAmountIndices.forEach(index => {
            const row = data[index];
            const amount = Math.abs(parseFloat(row.Amount) || 0);
            const isReturn = row.Type === 'Return';
            this.addToCategory('Food & Drink', row, amount, isReturn);
        });

        // Return data with processed items removed
        const allProcessedIndices = [...matchedIndices, ...gasLowAmountIndices];
        return data.filter((_, index) => !allProcessedIndices.includes(index));
    }

    processByCSVCategory(data) {
        const matchedIndices = [];

        data.forEach((row, index) => {
            const csvCategory = row.Category;
            const amount = Math.abs(parseFloat(row.Amount) || 0);
            const isReturn = row.Type === 'Return';
            
            // Check if CSV category matches any of our defined categories
            if (this.categoryTotals.hasOwnProperty(csvCategory)) {
                const minAmount = csvCategory === 'Gas' ? 20 : 0;
                
                if (csvCategory === 'Gas') {
                    // For gas: Returns go directly to Gas category regardless of amount
                    // Non-returns follow the $20 rule
                    if (isReturn || amount >= minAmount) {
                        this.addToCategory('Gas', row, amount, isReturn);
                        matchedIndices.push(index);
                    } else {
                        this.addToCategory('Food & Drink', row, amount, isReturn);
                        matchedIndices.push(index);
                    }
                } else if (amount >= minAmount) {
                    this.addToCategory(csvCategory, row, amount, isReturn);
                    matchedIndices.push(index);
                }
            }
        });

        // Return data with processed items removed
        return data.filter((_, index) => !matchedIndices.includes(index));
    }

    processOthersCategory(data) {
        data.forEach(row => {
            const amount = Math.abs(parseFloat(row.Amount) || 0);
            const isReturn = row.Type === 'Return';
            
            // Try smart categorization first
            const smartCategory = this.smartCategorize(row.Description);
            if (smartCategory !== 'Others') {
                this.smartCategorizedCount++;
                this.addToCategory(smartCategory, row, amount, isReturn);
            } else {
                this.addToCategory('Others', row, amount, isReturn);
            }
        });
    }

    addToCategory(category, row, amount, isReturn = false) {
        const finalAmount = isReturn ? -amount : amount;
        
        this.categoryTotals[category] += finalAmount;
        this.categoryTotals[category] = Math.round(this.categoryTotals[category] * 100) / 100;

        if (!this.categoryDetails[category]) {
            this.categoryDetails[category] = [];
        }

        this.categoryDetails[category].push({
            name: row.Description,
            date: this.formatDate(row['Transaction Date'] || row.Date),
            amount: finalAmount
        });
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
    }

    getDateRange() {
        if (this.processedData.length === 0) return '-';
        
        const dates = this.processedData
            .map(row => new Date(row['Transaction Date'] || row.Date))
            .filter(date => !isNaN(date));
        
        if (dates.length === 0) return '-';
        
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        return `${minDate.toLocaleDateString()} - ${maxDate.toLocaleDateString()}`;
    }

    getTotalExpenses() {
        return Object.values(this.categoryTotals)
            .filter(val => val > 0)
            .reduce((sum, val) => sum + val, 0);
    }

    getStats() {
        const nonZeroCategories = Object.entries(this.categoryTotals)
            .filter(([_, value]) => value > 0)
            .sort(([,a], [,b]) => b - a);

        const highest = nonZeroCategories[0] || ['-', 0];
        const lowest = nonZeroCategories[nonZeroCategories.length - 1] || ['-', 0];

        // Calculate days between first and last transaction
        const dates = this.processedData
            .map(row => new Date(row['Transaction Date'] || row.Date))
            .filter(date => !isNaN(date));
        
        const daysDiff = dates.length > 0 ? 
            Math.max(1, (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24) + 1) : 1;

        // Find largest single transaction
        const amounts = this.processedData.map(row => Math.abs(parseFloat(row.Amount) || 0));
        const largestTransaction = amounts.length > 0 ? Math.max(...amounts) : 0;

        // Find most frequent merchant/category
        const merchantCounts = {};
        this.processedData.forEach(row => {
            const merchant = row.Description.split(' ')[0]; // First word as merchant identifier
            merchantCounts[merchant] = (merchantCounts[merchant] || 0) + 1;
        });
        
        const mostFrequent = Object.entries(merchantCounts)
            .sort(([,a], [,b]) => b - a)[0] || ['-', 0];

        return {
            highest: { name: highest[0], amount: highest[1] },
            lowest: { name: lowest[0], amount: lowest[1] },
            avgPerDay: this.getTotalExpenses() / daysDiff,
            largestTransaction,
            mostFrequent: { name: mostFrequent[0], count: mostFrequent[1] },
            smartCategorized: this.smartCategorizedCount
        };
    }

    // Get monthly data for trends analysis
    getMonthlyData() {
        const monthlyData = {};
        
        this.processedData.forEach(row => {
            const date = new Date(row['Transaction Date'] || row.Date);
            if (isNaN(date)) return;
            
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const amount = Math.abs(parseFloat(row.Amount) || 0);
            const category = this.categorizeTransaction(row.Description);
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    total: 0,
                    categories: {},
                    transactionCount: 0
                };
            }
            
            monthlyData[monthKey].total += amount;
            monthlyData[monthKey].transactionCount++;
            
            if (!monthlyData[monthKey].categories[category]) {
                monthlyData[monthKey].categories[category] = 0;
            }
            monthlyData[monthKey].categories[category] += amount;
        });
        
        return monthlyData;
    }
}