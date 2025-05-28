import { BaseComponent } from '../base/base.js';

export class VikiCanvas extends BaseComponent {
    constructor() {
        super('viki-canvas');
    }
}

customElements.define('viki-canvas', VikiCanvas);
