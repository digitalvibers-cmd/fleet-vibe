import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class QueryBuilderComponent extends Component {
    @tracked table = null;
    @tracked selectedColumns = [];
    @tracked columnAliases = {};
    @tracked joins = [];
    @tracked conditions = [];
    @tracked groupBy = [];
    @tracked sortBy = [];
    @tracked limit = null;
    @tracked computedColumns = [];
    @tracked showQueryPreview = false;

    constructor() {
        super(...arguments);

        // Initialize with any provided values
        if (this.args.initialQuery) {
            this.loadFromQuery(this.args.initialQuery);
        }
    }

    get columns() {
        const columns = [];

        // Add columns from main table
        if (this.table?.columns) {
            this.table.columns.forEach((column) => {
                columns.push({
                    ...column,
                    table: this.table.name,
                    full: `${this.table.name}.${column.name}`,
                    label: column.label || column.name,
                });
            });
        }

        // Add columns from joined tables
        if (this.joins?.length) {
            this.joins.forEach((join) => {
                if (join.table?.columns) {
                    join.table.columns.forEach((column) => {
                        columns.push({
                            ...column,
                            table: join.table.name,
                            full: `${join.table.name}.${column.name}`,
                            label: `${join.table.label || join.table.name} - ${column.label || column.name}`,
                        });
                    });
                }
            });
        }

        return columns;
    }

    get allSelectedColumns() {
        const allColumns = [];

        // Add main table selected columns
        if (this.selectedColumns?.length) {
            allColumns.push(...this.selectedColumns);
        }

        // Add joined table selected columns
        if (this.joins?.length) {
            this.joins.forEach((join) => {
                if (join.selectedColumns?.length) {
                    allColumns.push(...join.selectedColumns);
                }
            });
        }

        return allColumns;
    }

    get resolvedTable() {
        if (this.table && !this.table.columns && this.args.tables?.length) {
            return this.args.tables.find((t) => t.name === this.table.name) ?? this.table;
        }
        return this.table;
    }

    get queryObject() {
        // Schema-defined computed columns (computed: true with computation expression) must be
        // routed to computed_columns with the `expression` key, not into the regular `columns` array
        const schemaComputedCols = this.selectedColumns.filter((c) => c.computed && c.computation);
        const regularCols = this.selectedColumns.filter((c) => !c.computed || !c.computation);

        const columns = regularCols.map((column) => ({
            ...column,
            alias: this.columnAliases[column.name] || null,
        }));

        const schemaComputedForQuery = schemaComputedCols.map((c) => ({
            name: c.name,
            expression: c.computation,
            type: c.type ?? 'decimal',
            label: c.label ?? c.name,
            computed: true,
        }));
        const allComputedColumns = [...(this.computedColumns || []), ...schemaComputedForQuery];

        // When GROUP BY is active, auto-add any selected non-grouped, non-computed column as a
        // dimension-only groupBy item so the backend doesn't reject the query under ONLY_FULL_GROUP_BY
        let groupBy = [...this.groupBy];
        if (groupBy.length > 0) {
            const groupedNames = new Set(groupBy.map((g) => g.groupBy?.name).filter(Boolean));
            for (const col of columns) {
                if (!groupedNames.has(col.name)) {
                    groupBy = [...groupBy, { id: `auto_dim_${col.name}`, groupBy: col }];
                }
            }
        }

        return {
            table: this.table,
            columns,
            computed_columns: allComputedColumns,
            joins: this.joins,
            conditions: this.conditions,
            groupBy,
            sortBy: this.sortBy,
            limit: this.limit,
        };
    }

    @action
    callbackChange(property, value, ...additionalArgs) {
        switch (property) {
            case 'table':
                this.table = value;
                // Reset dependent properties when table changes
                this.selectedColumns = [];
                this.columnAliases = {};
                this.joins = [];
                this.conditions = [];
                this.groupBy = [];
                this.sortBy = [];
                break;
            case 'columns':
                this.selectedColumns = value;
                if (additionalArgs[0]) {
                    this.columnAliases = additionalArgs[0];
                }
                break;
            case 'joins':
                this.joins = value;
                break;
            case 'conditions':
                this.conditions = value;
                break;
            case 'groupBy':
                this.groupBy = value;
                break;
            case 'sortBy':
                this.sortBy = value;
                break;
            case 'computedColumns':
                this.computedColumns = value;
                break;
            case 'limit':
                this.limit = value;
                break;
        }

        // Notify parent component of changes
        if (this.args.onChange) {
            this.args.onChange(this.queryObject);
        }
    }

    @action
    toggleQueryPreview() {
        this.showQueryPreview = !this.showQueryPreview;
    }

    @action
    loadFromQuery(queryData) {
        if (queryData.table) {
            const tableName = queryData.table.name ?? queryData.table;
            const fullTable = this.args.tables?.find((t) => t.name === tableName) ?? queryData.table;
            this.table = fullTable;
        }
        if (queryData.columns) {
            this.selectedColumns = queryData.columns;
            // Extract aliases
            const aliases = {};
            queryData.columns.forEach((column) => {
                if (column.alias) {
                    aliases[column.name] = column.alias;
                }
            });
            this.columnAliases = aliases;
        }
        if (queryData.joins) this.joins = queryData.joins;
        if (queryData.conditions) this.conditions = queryData.conditions;
        if (queryData.groupBy) this.groupBy = queryData.groupBy;
        if (queryData.sortBy) this.sortBy = queryData.sortBy;
        if (queryData.limit) this.limit = queryData.limit;
    }

    @action
    exportQuery() {
        return {
            sql: this.generatedQuery,
            object: this.queryObject,
        };
    }

    @action onExecute() {
        if (typeof this.args.onExecute === 'function') {
            this.args.onExecute(this.queryObject);
        }
    }

    @action onSave() {
        if (typeof this.args.onSave === 'function') {
            this.args.onSave(this.queryObject);
        }
    }

    @action onClear() {
        this.resetQuery();
        if (typeof this.args.onClear === 'function') {
            this.args.onClear(this.queryObject);
        }
    }

    @action
    resetQuery() {
        this.table = null;
        this.selectedColumns = [];
        this.columnAliases = {};
        this.joins = [];
        this.conditions = [];
        this.groupBy = [];
        this.sortBy = [];
        this.limit = null;
        this.showQueryPreview = false;

        if (this.args.onChange) {
            this.args.onChange(this.queryObject);
        }
    }
}
