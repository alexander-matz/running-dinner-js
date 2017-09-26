let vMap = (function() {
  "use strict";
  let view = null;
  let map = null;
  let search = null;
  let searchResult = null;
  let undoBtn = null;

  let mapControl = null;

  let markers = {};
  let searchHighlight = null;
  let mouseHighlight = null;

  let fuse = null;
  let history = [];

  /****************************************************************
   * search box
   **/

   function searchRebuild() {
     let teams = teamsModel.getAll();
     let directory = [];
     for (let i = 0; i < teams.length; ++i) {
       directory[i] = {
         id: teams[i].id,
         names: `${teams[i].cook1name} ${teams[i].cook1last}, ${teams[i].cook2name} ${teams[i].cook2last}`,
         address: `${teams[i].address}`,
       };
     }
     fuse = new Fuse(directory, {
       keys: ['id', 'names', 'address'],
       caseSensitive: false,
       tokenize: true,
     });
   }

   function searchOnInput(event) {
     if (fuse === null) {
       return;
     }
     let query = $(event.target).val().trim();
     let hits = fuse.search(query);
     if (query === '' || hits.length < 1) {
       searchHighlight = null;
       searchResult.text('');
       searchResult.attr('title', '');
     } else {
       searchHighlight = hits[0].id;
       let team = teamsModel.getOne(hits[0].id);
       searchResult.text(hits[0].names);
       searchResult.attr('title', team.address);
       if (!mapModel.isWithinBounds(team.lat, team.lng)) {
         searchResult.addClass('too-far');
       } else {
         searchResult.removeClass('too-far');
       }
     }
     markersUpdate();
     //console.log(hits);
   }

  /****************************************************************
   * markers
   **/

  function markerOnMouseEnter(e) {
    let info = e.target.options.custom;
    mouseHighlight = info.teamId;
    markersUpdate();
  }

  function markerOnMouseLeave(e) {
    mouseHighlight = null;
    markersUpdate();
  }

  function markerOnDragStart(e) {
    let info = e.target.options.custom;
    let {lat, lng} = e.target.getLatLng();
    info.origLatLng = {
      lat: lat,
      lng: lng,
    }
  }

  function markerOnDragEnd(e) {
    let info = e.target.options.custom;
    let {lat, lng} = e.target.getLatLng();
    let {lat: origLat, lng: origLng}  = info.origLatLng;
    info.origLatLng = undefined;
    let teamId = info.teamId;
    undoAdd(teamId, origLat, origLng);
    teamsModel.updateRow({
      id: info.teamId,
      lat: lat,
      lng: lng,
    });
  }

  function markersUpdate() {
    for (let teamId in markers) {
      let marker = markers[teamId];
      if (teamId == mouseHighlight || teamId == searchHighlight) {
        marker.setOpacity(1.0);
        marker._icon.innerHTML = marker.options.custom.fullText;
      } else {
        marker.setOpacity(0.6);
        marker._icon.innerHTML = marker.options.custom.teamId;
      }
    }
  }

  function markersRebuild() {
    for (let teamId in markers) {
      let marker = markers[teamId];
      mapControl.removeLayer(marker);
    }
    markers = {};
    let teams = teamsModel.getAll();
    for (let i = 0; i < teams.length; ++i) {
      let team = teams[i];
      if (team.lat !== null && team.lng !== null) {
        let icon = L.divIcon({
          className: 'map-marker-icon',
          iconSize: L.Point(8, 8),
          html: team.id,
        });
        let marker = L.marker([team.lat, team.lng], {
          icon: icon,
          draggable: true,
          riseOnHover: true,
          opacity: 0.6,
          custom: {
            teamId: team.id,
            fullText: `${team.cook1name} ${team.cook1last}, ${team.address}`,
            dragging: false,
          }
        });
        markers[team.id] = marker;
        marker.on('mouseover', markerOnMouseEnter);
        marker.on('mouseout', markerOnMouseLeave);
        marker.on('dragstart', markerOnDragStart);
        marker.on('dragend', markerOnDragEnd);
        marker.addTo(mapControl);
      }
    }
  }

  /****************************************************************
   * undo
   **/

  function undoUpdate() {
    if (history.length == 0) {
      undoBtn.prop('disabled', true);
    } else {
      undoBtn.prop('disabled', false);
    }
  }

  function undoOnClick() {
    if (history.length == 0) {
      return;
    }
    let [teamId, lat, lng] = history.splice(-1)[0];
    console.log(`resetting ${teamId} to ${lat}, ${lng}`);
    teamsModel.updateRow({
      id: teamId,
      lat: lat,
      lng: lng
    })
    markersRebuild();
    undoUpdate();
  }

  function undoAdd(team, lat, lng) {
    history[history.length] = [team, lat, lng];
    console.log(history);
    undoUpdate();
  }

  /****************************************************************
   * main
   **/

  function onInit(elem) {
    view = elem;

    let container = $('<div>').attr('id', 'map-container');
      let searchContainer = $('<div>').attr('id', 'map-search-container');
        let searchLabel = $('<div>').attr('id', 'map-search-label').text('find');
        search = $('<input>').attr('id', 'map-search');
        searchResult = $('<div>').attr('id', 'map-search-result');
      map = $('<div>').attr('id', 'map-leaflet');
      undoBtn = $('<button>').attr('id', 'map-undo').text('undo');

      container.append(searchContainer);
        searchContainer.append(searchLabel);
        searchContainer.append(search);
        searchContainer.append(searchResult);
      container.append(map);
      container.append(undoBtn);
    view.append(container);

    //************************
    // maps
    map.resize(() => {
      map.css({
        width: '100%',
        height: (map.parent().height() - 30) + 'px'
      })
      mapControl.invalidateSize();
    });
    let bounds = mapModel.getBounds();
    let center = [(bounds[0]+bounds[2])/2, (bounds[1]+bounds[3])/2];
    mapControl = L.map('map-leaflet', {
      center: center,
      zoom: 13,
    });
    L.tileLayer('http://a.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapControl);

    //************************
    // teams chaned
    let delayedOnTeamsChanged = delayedOnce.make(() => {
      searchRebuild();
      markersRebuild();
      undoUpdate();
    }, 0.5);
    sig.on('teams-modified', delayedOnTeamsChanged);

    //************************
    // undo

    undoBtn.on('click', undoOnClick);

    //************************
    // search
    search.on('keydown', (event) => {
      if (event.key === 'Escape') {
        search.val('');
        searchOnInput(event);
      }
    });
    search.on('input', delayedOnce.make((event) => {
      searchOnInput(event);
    }, 0.2));
  }

  function onActivate() {
  }

  return {
    onInit: onInit,
    onActivate: onActivate,
  };
})();
