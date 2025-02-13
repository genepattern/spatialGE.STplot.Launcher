import { param, run, poll_job } from '../visualizer/genepattern/visualizer_utils.js'
import Tags from "../visualizer/bootstrap/js/tags.js";

// 
window.Tags = Tags;

Vue.createApp({
    data() {
        return {
            genes: [],
            samples: [],
            samplesSelected: [],
            form: {
                genes: [],
                samples: [],
                colors: "BuRd",
                pointSize: 2.0,
                grid: "FALSE",
                rows: 3,
                columns: 3,
                legend: "TRUE",
                location: "bottom",
                spatialWeights: '',
                dynamicTreeCut: '',
                minimumClusters: '',
                maximumClusters: '',
                deepSplit: ''
            }
        };
    },
    created: function() {
        this.fetch_samples();
        this.fetch_genes();
        this.fetch_domains();
    },
    watch: {
        'form.grid'(newValue) {
            if (newValue === 'FALSE') {
                document.getElementById('rows')?.parentElement?.classList.add('d-none');
                document.getElementById('columns')?.parentElement?.classList.add('d-none');
                document.getElementById('legend')?.parentElement?.classList.add('d-none');
                document.getElementById('legendLocation')?.parentElement?.classList.add('d-none');
            }
            else {
                document.getElementById('rows')?.parentElement?.classList.remove('d-none');
                document.getElementById('columns')?.parentElement?.classList.remove('d-none');
                document.getElementById('legend')?.parentElement?.classList.remove('d-none');
                document.getElementById('legendLocation')?.parentElement?.classList.remove('d-none');
            }
        },
        'form.dynamicTreeCut'(newValue) {
            if (newValue === 'FALSE') {
                document.getElementById('minimumClusters')?.parentElement?.classList.remove('d-none');
                document.getElementById('maximumClusters')?.parentElement?.classList.remove('d-none');
            }
            else {
                document.getElementById('minimumClusters')?.parentElement?.classList.add('d-none');
                document.getElementById('maximumClusters')?.parentElement?.classList.add('d-none');
            }
        }
    },
    methods: {
        error_message(message) {
            setTimeout(() => {
                const error_box = document.getElementById('error');
                error_box.innerHTML = message;
                error_box.classList.remove('d-none');
            }, 100);
        },
        toggle_samples() {
            const selected = document.getElementById('check-all')?.checked;
            this.samples.forEach(item => (item.selected = selected));
        },
        fetch_samples() {
            let samples_url = param('sample.info');
            if (!samples_url) {
                samples_url = 'data/samples.json';
                this.error_message('Unable to get sample.info parameter\'s value');
            }

            fetch(samples_url)
                .then(r => r.json())
                .then(r => {
                    this.samples = r;
                    document.getElementById('sample-loading')?.classList.add('d-none');
                    setTimeout(() => {
                        const slider_max = Math.max(...this.samples.map(s => s.max_genes));
                        document.getElementById('numVariableGenesSlider')?.setAttribute('max', slider_max);
                    }, 100);
                });
        },
        fetch_genes() {
            let genes_url = param('gene.info');
            if (!genes_url) {
                genes_url = 'data/genes.json';
                this.error_message('Unable to get gene.info parameter\'s value');
            }

            fetch(genes_url)
                .then(r => r.json())
                .then(r => {
                    this.genes = r;
                    setTimeout(() => {
                        document.getElementById('genes')?.setAttribute('multiple', 'multiple');
                        const suggestions = this.genes.sort().map(x => {
                            return { 'value': x, 'label': x }
                        }).slice(0, 1000)
                        const allow_new = suggestions.length >= 1000;
                        Tags.init('#genes', {
                            items: suggestions,
                            allowNew: allow_new,
                            allowClear: true,
                            clearEnd: true,
                            showDropIcon: true,
                            separator: ',|\n| ',
                            keepOpen: false,
                            suggestionsThreshold: 0,
                            updateOnSelect: false,
                            max: 10
                        });
                    }, 100);
                });
        },
        fetch_domains() {
            let domains_url = param('domain.info');
            if (!domains_url) return;
            else {
                setTimeout(() => {
                    document.querySelectorAll('.clust-only').forEach (e => e.classList.remove('d-none'));
                }, 100);
            }

            fetch(domains_url)
                .then(r => r.json())
                .then(r => {
                    this.annotations = r.annotation_variables;
                    this.weights = new Set();
                    for (const a of this.annotations) {
                        const parts = a['label'].split('spatial weight:');
                        if (parts.length < 2) continue;
                        this.weights.add(parts[1]);
                    }
                    this.weights = Array.from(this.weights);
                    
                });
        },
        checked_samples() {
            const checks = document.getElementById('samples')
                .querySelectorAll('tbody input[type=checkbox]:checked');
            const names = [];
            checks.forEach(element => {
                if (element.hasAttribute('name')) {
                    names.push(element.getAttribute('name'));
                }
            });
            return names.join(',');
        },
        validate() {
            // Placeholder for custom validation, for now rely on browser default
            return true;
        },
        async handle_submit() {
            if (!this.validate()) return;

           $('#form-collapse').collapse('hide');
           $('#results-collapse').removeClass('d-none');

            document.getElementById('job-status').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting';
            let job = await run('spatialGE.STplot',
                [
                    {'name': 'input.file', 'values': [param('dataset')]},
                    {'name': 'genes', 'values': [this.form.genes.join(',')]},
                    {'name': 'samples', 'values': [this.checked_samples()]},
                    {'name': 'color.palette', 'values': [this.form.colors]},
                    {'name': 'point.size', 'values': [this.form.pointSize]},
                    {'name': 'spatial.weights', 'values': [this.form.spatialWeights]},
                    {'name': 'dynamic.tree.cut', 'values': [this.form.dynamicTreeCut]},
                    {'name': 'minimum.clusters', 'values': [this.form.minimumClusters]},
                    {'name': 'maximum.clusters', 'values': [this.form.maximumClusters]},
                    {'name': 'deep.split', 'values': [this.form.deepSplit]},
                    {'name': 'display.in.grid', 'values': [this.form.grid]},
                    {'name': 'grid.rows', 'values': [this.form.rows]},
                    {'name': 'grid.columns', 'values': [this.form.columns]},
                    {'name': 'common.legend', 'values': [this.form.legend]},
                    {'name': 'legend.location', 'values': [this.form.location]}
                ]);

            // Poll for completion
            job = await poll_job(job, update => {
                let status = '<i class="fa-solid fa-spinner fa-spin"></i> ';
                if      (update.status.hasError)   status =  'Error';
                else if (update.status.isFinished) status =  'Complete';
                else if (update.status.isPending)  status += 'Pending';
                else                               status += 'Running';

                document.getElementById('job-status').innerHTML = status;
            });
            
            window.show_plot = (url) => {
                document.querySelector('#displayedplot').innerHTML = 
                    `<img src="${url}" class="img mx-auto d-block" style="max-width: 500px;">`;
            };

            // Show the job results
            let result_html = `<table class="table table-sm table-striped">
                                  <thead>
                                    <tr>
                                      <th scope="col">File</th>
                                      <th scope="col">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>`;
            for (const result of job.outputFiles) {
                if (result.link.href.endsWith('.jpg'))
                    result_html += `<tr><td>${result.link.name}</td>
                                        <td>
                                            <a href="#displayedplot" onclick="show_plot('${result.link.href}')" class="btn btn-secondary btn-sm">View Plot</a>
                                            <a href="${result.link.href}?download" target="_blank" class="btn btn-secondary btn-sm">Download</a> 
                                            <a href="#" onclick="window.open('${result.link.href}');" class="btn btn-secondary btn-sm">Open in New Tab</a></td></tr>`;
                else
                    result_html += `<tr><td>${result.link.name}</td>
                                        <td>
                                            <a href="${result.link.href}?download" target="_blank" class="btn btn-secondary btn-sm">Download</a> 
                                            <a href="#" onclick="window.open('${result.link.href}');" class="btn btn-secondary btn-sm">Open in New Tab</a></td></tr>`;
            }
            result_html += "</tbody></table><div id='displayedplot' class='row'></div>";
            document.getElementById('job-results').innerHTML = result_html;
        }
    }
}).mount('#app');
