function UIButton(domElement, x, y, text, cb){
    this.button = document.createElement('button');
    this.button.style.position = 'absolute';
    this.button.style.left = x + 'px';
    this.button.style.top = y + 'px';
    this.button.innerHTML = text;
    domElement.appendChild(this.button);
    this.button.addEventListener('click', cb);
}

function UISlider(domElement, min, max, x, y, cb){
    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = min;
    this.slider.max = max;
    this.slider.step = (max - min) * 0.01;
    this.slider.style.position = 'absolute';
    this.slider.style.left = x + 'px';
    this.slider.style.top = y + 'px';
    domElement.appendChild(this.slider);
    this.slider.addEventListener('input', cb);
}

UISlider.prototype.getValue = function(){
    return this.slider.value;
}

UISlider.prototype.setValue = function(value){
    this.slider.value = value;
}

export {UIButton, UISlider}