var BASE = 'https://combiner-api.run.aws-usw02-pr.ice.predix.io';
//var PREFIX = '';
var PREFIX = '/static';

Chart.defaults.global.maintainAspectRatio = false;
Chart.defaults.global.legend.display = false;
Chart.defaults.global.defaultColor = '#333';
Chart.defaults.global.defaultFontColor = '#333';

var makeChart = function(container, xy, color) {
  var labels = [];
  var datapoints = [];
  for (var x in xy) {
    labels.push(xy[x][0]);
    datapoints.push(xy[x][1]);
  }

  var data = {
    labels: labels,
    datasets: [
      {
        fill: false,
        lineTension: 0.1,
        backgroundColor: 'rgba(' + color + ',0.4)',
        borderColor: 'rgba(' + color + ',1)',
        borderCapStyle: 'butt',
        borderDash: [],
        borderDashOffset: 0.0,
        borderJoinStyle: 'miter',
        pointBorderColor: 'rgba(' + color + ',1)',
        pointBackgroundColor: "#fff",
        pointBorderWidth: 1,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: 'rgba(' + color + ',1)',
        pointHoverBorderColor: "rgba(220,220,220,1)",
        pointHoverBorderWidth: 2,
        pointRadius: 1,
        pointHitRadius: 10,
        data: datapoints
      }
    ]
  };

  var canvas = container.find('canvas');
  if (canvas.length) {
    console.log('Changing data');
    var existingChart = canvas.data('chart');
    var existingData = canvas.data('data');
    existingData.labels = labels;
    existingData.datasets[0].data = datapoints;
    existingChart.update();
  } else {
    container.append('<canvas/>');
    canvas = container.find('canvas');
    canvas.data('data', data);
    canvas.data('chart', new Chart(canvas, {
      type: 'line',
      data: data
    }));
  }
};

var showProgress = function() {
  NProgress.start();
};

var closeProgress = function() {
  NProgress.done();
};

var showMap = function(zip) {
  var url = 'https://maps.googleapis.com/maps/api/staticmap?center=' + zip + '&size=640x400&zoom=14';
  $('#map').css({
    backgroundImage: 'url(' + url + ')'
  });
};

var loadDistricts = function() {
  showProgress();
  $.ajax({
    url: BASE + '/districts',
    success: function(districts) {
      districts.forEach(function(district) {
        var newOption = $('<option/>');
        newOption.text(district);
        newOption.attr('value', district);
        $('#did').append(newOption);
      });
      $('#did').removeAttr('disabled');
      closeProgress();
    },
    error: function() {
      closeProgress();
    }
  });
};

var onDistrictSelect = function() {
  var districtId = $('#did').val();
  if (districtId === '') {
    $('#zip').not(':first').remove();
    $('#zip').attr('disabled', 'disabled');
    return;
  }
  showProgress();
  $.ajax({
    url: BASE + '/districts?district=' + districtId,
    success: function(zips) {
      $('#zip').not(':first').remove();
      zips.forEach(function(zip) {
        var newOption = $('<option/>');
        newOption.text(zip);
        newOption.attr('value', zip);
        $('#zip').append(newOption);
      });
      $('#zip').removeAttr('disabled');
      closeProgress();
    },
    error: function() {
      closeProgress();
    }
  });
};

var metricsLoad = function(container, type, andThen) {
  var newDots = $('<span class="dots"><span>.</span><span>.</span><span>.</span></span>');
  container.append(newDots);
  $.ajax({
    url: BASE + PREFIX + '/' + type,
    success: function(data) {
      container.find('.dots').remove();
      andThen(container, data);
    },
    error: function() {
      container.find('.dots').remove();
    }
  });
};

var discretize = function(xys) {
  var buckets = {};
  var newXys = [];
  xys.forEach(function(xy) {
    var date = new Date(xy[0]);
    date.setSeconds(0, 0);
    var count = xy[1];
    var dateString = date.toISOString();
    dateString = dateString.substring(0, dateString.length - 8);
    buckets[dateString] = dateString in buckets ? buckets[dateString] + count : count;
  });
  for (var x in buckets) {
    newXys.push([x, buckets[x]]);
  }
  return newXys;
};

var insertTrafficData = function(container, data) {
  var xy = [];
  data.forEach(function(assetData) {
    assetData._embedded.events.forEach(function(event) {
      var vehicleCount = event.measures.filter(function(m) { return m.tag == 'vehicleCount'; });
      if (vehicleCount) {
        xy.push([event.timestamp, vehicleCount[0].value]);
      }
    });
  });
  xy.sort(function(left, right) {
    if (left[0] < right[0]) {
      return -1;
    } else if (left[0] > right[0]) {
      return 1;
    } else {
      return 0;
    }
  });
  xy = discretize(xy);
  makeChart(container, xy, '75,192,192');
};

var showMetrics = function() {
  if ($('#zip').val()) {
    $('#metrics').fadeIn();
  } else {
    $('#metrics').fadeOut();
  }
};

var makeBarChart = function(container, data) {
  var labels = [];
  var datapoints = [];
  var colors = [];
  for (var k in data) {
    labels.push(k);
    datapoints.push(data[k]);
    colors.push('#'+Math.floor(Math.random()*16777215).toString(16));
  }

  var ctx = $('<canvas/>');
  container.append(ctx);
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{data:datapoints, backgroundColor: colors}],
    }
  });
};

var populateDemographics = function(data) {
  var householdIncome = {};
  data.themes.incomeTheme.rangeVariable[0].field.forEach(function(point) {
    householdIncome[point.description] = parseFloat(point.value);
  });
  makeBarChart($('#householdIncome'), householdIncome);
  $('#householdIncome').fadeIn();

  var ethnicity = {};
  data.themes.raceTheme.rangeVariable[0].field.forEach(function(point) {
    ethnicity[point.description] = parseFloat(point.value);
  });
  makeBarChart($('#ethnicity'), ethnicity);
  $('#ethnicity').fadeIn();

  var maritalStatus = {};
  data.themes.maritalStatusTheme.rangeVariable[0].field.forEach(function(point) {
    maritalStatus[point.description] = parseFloat(point.value);
  });
  makeBarChart($('#maritalStatus'), maritalStatus);
  $('#maritalStatus').fadeIn();
};

var demographics = function(lat, lon) {
  var newDots = $('<span class="dots"><span>.</span><span>.</span><span>.</span></span>');
  $('#demographics').append(newDots);
  $.ajax({
    url: BASE + '/demographics?lat=' + lat + '&lon=' + lon,
    success: function(data) {
      $('#demographics').find('.dots').remove();
      populateDemographics(data);
    }
  });
};

var nonTemporalData = function(zip) {
  $.ajax({
    url: BASE + '/postal?postal=' + zip,
    success: function(data) {
      var coords = data.candidates[0].geometry.coordinates;
      showMap(zip);
      $('#map h2').text('San Diego, CA');
      $('#map').off('click');
      $('#map').click(function() {
        window.location.href = 'https://maps.google.com/?q=' + zip;
      });
      demographics(coords[1], coords[0]);
    }
  });
};

var insertParkingData = function(container, data) {
  var xy = [];
  data.forEach(function(assetData) {
    assetData._embedded.events.forEach(function(event) {
      var type = event['event-type'];
      xy.push([event.timestamp, 1]);
    });
  });
  xy.sort(function(left, right) {
    if (left[0] < right[0]) {
      return -1;
    } else if (left[0] > right[0]) {
      return 1;
    } else {
      return 0;
    }
  });
  xy = discretize(xy);
  makeChart(container, xy, '104,72,91');
};

var insertPedestrianData = function(container, data) {
  var xy = [];
  data.forEach(function(assetData) {
    assetData._embedded.events.forEach(function(event) {
      xy.push([event.timestamp, event.measures[0].value]);
    });
  });
  xy.sort(function(left, right) {
    if (left[0] < right[0]) {
      return -1;
    } else if (left[0] > right[0]) {
      return 1;
    } else {
      return 0;
    }
  });
  xy = discretize(xy);
  makeChart(container, xy, '135,193,114');
};

var onZipSelect = function() {
  var zip = $('#zip').val();
  if (!zip) {
    return;
  }
  showMetrics();
  nonTemporalData(zip);
  metricsLoad($('#traffic'), 'traffic', insertTrafficData);
  metricsLoad($('#parking'), 'parking', insertParkingData);
  metricsLoad($('#pedestrians'), 'pedestrian', insertPedestrianData);
};

$(function() {
  $('#did').change(onDistrictSelect);
  $('#zip').change(onZipSelect);
  loadDistricts();
});
