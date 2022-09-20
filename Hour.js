function Hour(timeInString) {
    if (!timeInString) {
        this.hour = 0;
        this.minute = 0;
        this.sencond = 0;
    }
    else {
        let times = timeInString.split(':');
        this.hour = parseInt(times[0]);
        this.minute = parseInt(times[1]);
        this.sencond = parseInt(times[2]);
    }
}

Hour.prototype = {
    toSeconds: function () {
        return this.hour * 60 * 60 + this.minute * 60 + this.sencond;;
    },
    toMinutes: function () {
        return this.hour * 60 + this.minute + this.sencond / 60;
    },
    toHours: function () {
        return this.hour + this.minute / 60 + this.sencond / (60 * 60);
    },
    copy: function (toCopy) {
        this.hour = parseInt(toCopy.hour);
        this.minute = parseInt(toCopy.minute);
        this.sencond = parseInt(toCopy.sencond);
    }
}

/**
 * a >= b ?
 * @param {Hour} a 
 * @param {Hour} b 
 */
Hour.greaterOrEqual = function (a, b) {
    if (a == null && b == null) {
        console.warn('both of them are null value returning true');
        return true;
    }
    else if (a == null || b == null) {
        if (a == null) {
            console.warn('a is null value returning false');
            return false;
        }
        if (b == null) {
            console.warn('b is null value returning true');
            return true;
        }
    }
    return a.toSeconds() >= b.toSeconds()
}
/**
 * a > b ?
 * @param {Hour} a 
 * @param {Hour} b 
 */
Hour.greater = function (a, b) {
    if (a == null && b == null) {
        console.warn('both of them are null value returning false');
        return false;
    }
    else if (a == null || b == null) {
        if (a == null) {
            console.warn('a is null value returning false');
            return false;
        }
        if (b == null) {
            console.warn('b is null value returning true');
            return true;
        }
    }
    return a.toSeconds() > b.toSeconds()
}
/**
 * a == b ?
 * @param {Hour} a 
 * @param {Hour} b 
 */
Hour.equals = function (a, b) {
    if (a == null && b == null) {
        console.warn('both of them are null value returning true');
        return true;
    }
    else if (a == null || b == null) {
        if (a == null) {
            console.warn('a is null value returning false');
            return false;
        }
        if (b == null) {
            console.warn('b is null value returning false');
            return false;
        }
    }
    return a.toSeconds() == b.toSeconds();
}
/**
 * Construct Hour from seconds
 * @param {Number} _seconds 
 */
Hour.fromSeconds = function (_seconds) {
    _seconds = parseInt(_seconds);
    let toReturn = new Hour();

    if (_seconds < 0) {
        console.warn('seconds are negative value. underflowing')
        _seconds = 24 * 60 * 60 + _seconds;
    }
    let hour = parseInt(Math.floor(_seconds / (60 * 60)));
    _seconds -= hour * 60 * 60;
    let minute = parseInt(Math.floor(_seconds / (60)));
    _seconds -= minute * 60;
    let second = _seconds;

    toReturn.hour = hour;
    toReturn.minute = minute;
    toReturn.sencond = second;
    return toReturn;
}
/**
 * a+b
 * @param {Hour} a 
 * @param {Hour} b 
 */
Hour.add = function (a, b) {
    return Hour.fromSeconds(a.toSeconds + b.toSeconds);
}
/**
 * a-b
 * @param {Hour} a 
 * @param {Hour} b 
 */
Hour.sub = function (a, b) {
    return Hour.fromSeconds(a.toSeconds + b.toSeconds);
}

Hour.prototype.toString = function () {
    let numToString = function (num) {
        if (num == 0)
            return '00';
        else if (num < 10)
            return '0' + num
        else
            return num;
    }
    return `${numToString(this.hour)}:${numToString(this.minute)}:${numToString(this.sencond)}`
}

/**
 * max(a,b)
 * @param {Hour} a 
 * @param {Hour} b 
 */
Hour.max = function(a, b){
    return Hour.greaterOrEqual(a,b)? a : b;
}

/**
 * min(a,b)
 * @param {Hour} a 
 * @param {Hour} b 
 */
Hour.min = function(a, b){
    return Hour.greaterOrEqual(a,b)? b : a;
}

export {Hour}