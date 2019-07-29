import { IPageConfigNode } from "./PageStructureReader";

export class PageStructureValidator {
    validate(pages: IPageConfigNode[]) {
        if (!Array.isArray(pages)) {
            throw new Error(`"pages" must be an array.`);
        }

        pages.forEach((page, i) => {
            if (typeof page !== "object") {
                throw new Error(`"pages[${i}]" is not an object`);
            }

            if (!page.def || !page.def.match(/^page:\/\//)) {
                throw new Error(`"pages[${i}]" must refer to a page definition.`);
            }

            if (page.pageCritical !== void 0) {
                throw new Error(`"pages[${i}]" is invalid. Only modules and contexts may specify "pageCritical"`);
            }

            let [valid, err] = this.validateChildrenObject(page.children as Record<string, IPageConfigNode[]>);
            if (!valid) {
                throw new Error(`"pages[${i}]" is invalid. ${err}`);
            }
        });
    }

    validateModuleMap(modules: Record<string, IPageConfigNode[]>) {
        if (typeof modules !== "object") {
            throw new Error(`"rootModules" must be an object.`);
        }
        for (let key of Object.keys(modules)) {
            let [valid, err] = this.validateChildrenArray(modules[key]);
            if (!valid) {
                throw new Error(`rootModules[${key}] is invalid. ${err}`);
            }
        }
    }

    private validateChildrenObject(children: Record<string, IPageConfigNode[]>): [true] | [false, string] {
        if (typeof children !== "object") {
            return [false, `"children" must be an object.`];
        }
        for (let key of Object.keys(children)) {
            let [valid, err] = this.validateChildrenArray(children[key]);
            if (!valid) {
                return [false, `children[${key}] is invalid. ${err}`];
            }
        }

        return [true];
    }

    private validateChildrenArray(children: IPageConfigNode[]): [true] | [false, string] {
        if (!Array.isArray(children)) {
            return [false, `Should be an array.`];
        }
        for (let [i, child] of children.entries()) {
            if (!child.def || !child.def.match(/^(module|context):\/\//)) {
                return [false, `Index ${i} must refer to a module or context definition.`];
            }

            if (child.def.match(/^module:\/\//)) {
                let [valid, err] = this.validateModule(child);
                if (!valid) {
                    return [false, `Index ${i} is not a valid module. ${err}`];
                }
            } else {
                let [valid, err] = this.validateContext(child);
                if (!valid) {
                    return [false, `Index ${i} is not a valid context. ${err}`];
                }
            }
        }

        return [true];
    }

    private validateModule(mod: IPageConfigNode): [true] | [false, string] {
        if (typeof mod !== "object") {
            return [false, `Not a module object`];
        }

        if (mod.children) {
            let [valid, err] = this.validateChildrenObject(mod.children as Record<string, IPageConfigNode[]>);
            if (!valid) {
                return [false, `"children" object is invalid. ${err}`];
            }
        }

        return [true];
    }

    private validateContext(context: IPageConfigNode): [true] | [false, string] {
        if (typeof context !== "object") {
            return [false, `Not a context object`];
        }

        if (context.options !== void 0) {
            return [false, `Only pages and modules may specify "options"`];
        }

        let [valid, err] = this.validateChildrenArray(context.children as IPageConfigNode[]);
        if (!valid) {
            return [false, `"children" array is invalid. ${err}`];
        }

        return [true];
    }
}
